package com.queuevelocity;

import com.google.inject.Inject;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.LoginEvent;
import com.velocitypowered.api.event.player.KickedFromServerEvent;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import com.velocitypowered.api.proxy.server.ServerInfo;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import java.util.regex.Pattern;
import net.kyori.adventure.bossbar.BossBar;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import net.kyori.adventure.title.Title;

@Plugin(id = "queue-velocity", name = "Queue Velocity", version = "0.1.0")
public final class QueueVelocityPlugin {
  private final ProxyServer proxy;
  private final Logger logger;
  private final Path dataDirectory;
  private final Map<UUID, QueueSession> sessions = new ConcurrentHashMap<>();
  private final Map<UUID, String> requestedHosts = new ConcurrentHashMap<>();
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private QueueConfig config;

  @Inject
  public QueueVelocityPlugin(ProxyServer proxy, Logger logger, @DataDirectory Path dataDirectory) {
    this.proxy = proxy;
    this.logger = logger;
    this.dataDirectory = dataDirectory;
  }

  @Subscribe
  public void onInitialize(ProxyInitializeEvent event) {
    try {
      config = QueueConfig.load(dataDirectory);
    } catch (IOException error) {
      throw new IllegalStateException("Unable to load Queue Velocity configuration", error);
    }
    proxy.getScheduler().buildTask(this, this::pollSessions)
        .repeat(config.pollIntervalSeconds(), TimeUnit.SECONDS).schedule();
    logger.info("Queue Velocity enabled; limbo=" + config.limboServer());
  }

  @Subscribe
  public void onLogin(LoginEvent event) {
    Player player = event.getPlayer();
    player.getVirtualHost().ifPresent(host -> requestedHosts.put(player.getUniqueId(), host.getHostString().toLowerCase()));
    QueueSession prior = sessions.get(player.getUniqueId());
    if (prior != null) prior.player = player;
  }

  @Subscribe
  public void onKickedFromRouter(KickedFromServerEvent event) {
    if (!event.getServer().getServerInfo().getName().equalsIgnoreCase(config.routerServer())) return;
    String message = PlainTextComponentSerializer.plainText().serialize(event.getServerKickReason().orElse(Component.empty()));
    if (!config.unavailablePattern().matcher(message).matches()) return;

    Player player = event.getPlayer();
    String serverAddress = requestedHosts.get(player.getUniqueId());
    if (serverAddress == null || serverAddress.isBlank()) {
      logger.warning("Cannot queue " + player.getUsername() + ": no requested virtual host");
      return;
    }
    Optional<RegisteredServer> limbo = proxy.getServer(config.limboServer());
    if (limbo.isEmpty()) {
      logger.severe("Configured limbo server is not registered: " + config.limboServer());
      return;
    }
    event.setResult(KickedFromServerEvent.RedirectPlayer.create(limbo.get()));
    beginQueue(player, serverAddress);
  }

  @Subscribe
  public void onDisconnect(DisconnectEvent event) {
    UUID playerId = event.getPlayer().getUniqueId();
    requestedHosts.remove(playerId);
    QueueSession session = sessions.get(playerId);
    if (session == null) return;
    proxy.getScheduler().buildTask(this, () -> {
      if (proxy.getPlayer(playerId).isEmpty() && sessions.remove(playerId, session)) {
        cancel(session);
      }
    }).delay(config.disconnectGraceSeconds(), TimeUnit.SECONDS).schedule();
  }

  private void beginQueue(Player player, String serverAddress) {
    QueueSession existing = sessions.get(player.getUniqueId());
    if (existing != null && existing.serverAddress.equals(serverAddress)) {
      existing.player = player;
      showWaitingUi(existing, "Resuming your queue...");
      return;
    }
    proxy.getScheduler().buildTask(this, () -> {
      try {
        QueueState state = createQueue(serverAddress, player.getUniqueId());
        QueueSession session = new QueueSession(player, serverAddress, state.queueId(), state);
        QueueSession replaced = sessions.put(player.getUniqueId(), session);
        if (replaced != null) cancel(replaced);
        showWaitingUi(session, "Server starting...");
      } catch (Exception error) {
        logger.warning("Unable to create queue entry for " + player.getUsername() + ": " + error.getMessage());
        player.sendMessage(Component.text("Unable to join the startup queue. Please try again."));
      }
    }).schedule();
  }

  private void pollSessions() {
    for (QueueSession session : sessions.values()) {
      try {
        QueueState state = getQueue(session.queueId);
        session.state = state;
        switch (state.status()) {
          case "waiting", "starting" -> showWaitingUi(session, "Server starting...");
          case "ready" -> connectToReadyServer(session, state);
          case "failed" -> failSession(session, state.failureReason());
          case "cancelled" -> removeSession(session);
          default -> logger.warning("Unknown queue status " + state.status());
        }
      } catch (Exception error) {
        logger.warning("Unable to poll queue " + session.queueId + ": " + error.getMessage());
      }
    }
  }

  private void connectToReadyServer(QueueSession session, QueueState state) {
    if (state.backend() == null || state.backend().isBlank()) {
      failSession(session, "Server is ready but did not provide a backend address.");
      return;
    }
    try {
      InetSocketAddress address = BackendAddress.parse(state.backend());
      RegisteredServer backend = proxy.getServer(session.serverAddress).orElseGet(() ->
          proxy.registerServer(new ServerInfo(session.serverAddress, address)));
      session.player.createConnectionRequest(backend).connect().thenAccept(result -> {
        if (result.isSuccessful()) removeSession(session);
        else failSession(session, "Server became unavailable. Please try again.");
      });
    } catch (Exception error) {
      failSession(session, "Could not connect to ready server.");
    }
  }

  private void showWaitingUi(QueueSession session, String title) {
    QueueState state = session.state;
    String line = state.position() == null ? "Preparing your server..."
        : "Position #" + state.position() + " • Estimated wait: " + formatEta(state.estimatedWaitSeconds());
    if (session.bossBar == null) {
      session.bossBar = BossBar.bossBar(Component.text(title), 1.0f, BossBar.Color.BLUE, BossBar.Overlay.PROGRESS);
      session.player.showBossBar(session.bossBar);
      session.player.showTitle(Title.title(Component.text(title), Component.text(line)));
    } else {
      session.bossBar.name(Component.text(title + " — " + line));
    }
    session.player.sendActionBar(Component.text(line));
  }

  private void failSession(QueueSession session, String reason) {
    session.player.sendMessage(Component.text(reason == null ? "Server startup failed." : reason));
    removeSession(session);
  }

  private void removeSession(QueueSession session) {
    sessions.remove(session.player.getUniqueId(), session);
    if (session.bossBar != null) session.player.hideBossBar(session.bossBar);
  }

  private void cancel(QueueSession session) {
    try {
      HttpRequest request = requestBuilder("/queue/" + session.queueId).DELETE().build();
      http.send(request, HttpResponse.BodyHandlers.discarding());
    } catch (Exception error) {
      logger.warning("Unable to cancel queue " + session.queueId + ": " + error.getMessage());
    }
  }

  private QueueState createQueue(String serverAddress, UUID playerId) throws IOException, InterruptedException {
    String json = "{\"serverAddress\":\"" + escapeJson(serverAddress) + "\",\"playerUuid\":\"" + playerId + "\"}";
    HttpResponse<String> response = http.send(requestBuilder("/queue")
        .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)).build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200 && response.statusCode() != 201) throw new IOException("Scaler returned " + response.statusCode());
    return QueueState.parse(response.body());
  }

  private QueueState getQueue(String queueId) throws IOException, InterruptedException {
    HttpResponse<String> response = http.send(requestBuilder("/queue/" + queueId).GET().build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) throw new IOException("Scaler returned " + response.statusCode());
    return QueueState.parse(response.body());
  }

  private HttpRequest.Builder requestBuilder(String path) {
    return HttpRequest.newBuilder(URI.create(config.scalerUrl() + path)).timeout(Duration.ofSeconds(10))
        .header("Authorization", "Bearer " + config.apiSecret()).header("Content-Type", "application/json");
  }

  private static String formatEta(Long seconds) {
    if (seconds == null) return "~unknown";
    return "~" + (seconds / 60) + ":" + String.format("%02d", seconds % 60);
  }

  private static String escapeJson(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
}