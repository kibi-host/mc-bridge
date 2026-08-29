package com.queuevelocity;

import java.net.InetSocketAddress;

final class BackendAddress {
  static InetSocketAddress parse(String backend) {
    String host = backend;
    int port = 25565;
    int split = backend.lastIndexOf(':');
    if (split > 0 && backend.indexOf(':') == split) {
      host = backend.substring(0, split);
      port = Integer.parseInt(backend.substring(split + 1));
    }
    return InetSocketAddress.createUnresolved(host, port);
  }
}
