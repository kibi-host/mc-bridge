package com.queuevelocity;

import com.velocitypowered.api.proxy.Player;
import net.kyori.adventure.bossbar.BossBar;

final class QueueSession {
  volatile Player player;
  final String serverAddress;
  final String queueId;
  volatile QueueState state;
  volatile BossBar bossBar;

  QueueSession(Player player, String serverAddress, String queueId, QueueState state) {
    this.player = player;
    this.serverAddress = serverAddress;
    this.queueId = queueId;
    this.state = state;
  }
}
