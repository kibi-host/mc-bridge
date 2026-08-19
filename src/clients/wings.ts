import { config } from "./config.js";
import { hasCapacity } from "./nodeCapacity.js";
import type { ServerRecord } from "./types.js";

/**
 * INTEGRATION SEAM. The path/payload below follow Calagopus's documented
 * router convention (/api/admin/..., /api/client/..., /api/client/servers/
 * {uuid}/...) and its confirmed power signals (start/stop/restart/kill) —
 * but the exact path and auth scheme for calling power actions as an
 * automation/admin key, rather than from a logged-in client session, is
 * NOT something I could confirm from public docs. Check your panel's own
 * API Reference (the button in the panel header) before trusting this.
 */

class InsufficientCapacityError extends Error {}

export async function startServer(record: ServerRecord): Promise<string> {
  const ok = await hasCapacity(record.nodeId, record.memoryMb);
  if (!ok) {
    // Deliberately don't call Wings at all — starting into a full node
    // risks OOM-killing an unrelated server on the same host, not just
    // failing this one. Let the caller decide how to surface this
    // (currently: fail the scale-up, the connecting player sees a
    // failed connection instead of an eventual timeout).
    throw new InsufficientCapacityError(`Node ${record.nodeId} lacks capacity for ${record.serverAddress}`);
  }

  const res = await fetch(`${config.wingsApiUrl}/api/client/servers/${record.wingsServerId}/power`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.wingsApiToken}`,
    },
    body: JSON.stringify({ signal: "start" }),
  });
  if (!res.ok) {
    throw new Error(`Wings start failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { host: string; port: number };
  return `${body.host}:${body.port}`;
}

export async function stopServer(record: ServerRecord): Promise<void> {
  const res = await fetch(`${config.wingsApiUrl}/api/client/servers/${record.wingsServerId}/power`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.wingsApiToken}`,
    },
    body: JSON.stringify({ signal: "stop" }),
  });
  if (!res.ok) {
    throw new Error(`Wings stop failed (${res.status}): ${await res.text()}`);
  }
}

export { InsufficientCapacityError };