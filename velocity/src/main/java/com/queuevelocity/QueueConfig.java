package com.queuevelocity;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import java.util.regex.Pattern;

record QueueConfig(String scalerUrl, String apiSecret, String routerServer, String limboServer,
    long pollIntervalSeconds, long disconnectGraceSeconds, Pattern unavailablePattern) {
  static QueueConfig load(Path dataDirectory) throws IOException {
    Files.createDirectories(dataDirectory);
    Path config = dataDirectory.resolve("queue-velocity.properties");

    if (!Files.exists(config))
      throw new IOException("Missing " + config);

    Properties properties = new Properties();

    try (InputStream input = Files.newInputStream(config)) {
      properties.load(input);
    }

    String secret = required(properties, "queue-api-secret");

    return new QueueConfig(trimTrailingSlash(required(properties, "scaler-url")), secret,
        properties.getProperty("router-server", "router"), properties.getProperty("limbo-server", "limbo"),
        Long.parseLong(properties.getProperty("poll-interval-seconds", "5")),
        Long.parseLong(properties.getProperty("disconnect-grace-seconds", "60")),
        Pattern.compile(properties.getProperty("unavailable-message-pattern", ".*")));
  }

  private static String required(Properties properties, String key) throws IOException {
    String value = properties.getProperty(key);

    if (value == null || value.isBlank() || value.contains("${"))
      throw new IOException("Missing required property: " + key);

    return value.trim();
  }

  private static String trimTrailingSlash(String value) {
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }
}
