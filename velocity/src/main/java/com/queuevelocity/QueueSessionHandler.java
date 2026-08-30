package com.queuevelocity;

import net.elytrium.limboapi.api.Limbo;
import net.elytrium.limboapi.api.player.LimboPlayer;
import net.elytrium.limboapi.api.LimboSessionHandler;

/** Bridges LimboAPI spawn/disconnect callbacks back onto a {@link QueueSession}. */
final class QueueSessionHandler implements LimboSessionHandler {
  private final QueueVelocityPlugin plugin;
  private final QueueSession session;
  private final String initialTitle;

  QueueSessionHandler(QueueVelocityPlugin plugin, QueueSession session, String initialTitle) {
    this.plugin = plugin;
    this.session = session;
    this.initialTitle = initialTitle;
  }

  @Override
  public void onSpawn(Limbo server, LimboPlayer limboPlayer) {
    session.limboPlayer = limboPlayer;
    plugin.showWaitingUi(session, initialTitle);
  }

  @Override
  public void onDisconnect() {
    // No-op: DisconnectEvent + connectToReadyServer already handle session
    // cleanup. This only fires if the client itself drops while queued.
  }
}