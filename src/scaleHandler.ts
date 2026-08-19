import { getServerRecord } from "./serverRegistry.js";
import { startServer, stopServer, InsufficientCapacityError } from "./wingsClient.js";
import type { ScaleWebhookPayload, ScaleWebhookResult } from "./types.js";

export async function handleScaleWebhook(payload: ScaleWebhookPayload): Promise<ScaleWebhookResult> {
  const record = await getServerRecord(payload.serverAddress);

  if (!record) {
    // Unknown route — nothing we can do with it. Let mc-router's own
    // "missing-backend" handling take over.
    return { status: 404 };
  }

  if (record.tier === "paid") {
    if (payload.action === "up") {
      // Already running — just confirm quickly, no Wings call needed.
      return { status: 200 };
    }
    // Deliberately refuse to scale down a paid server. mc-router treats
    // a non-2xx as a failed scale-down and retries next idle cycle
    // instead of marking the route asleep, so paid players never see a
    // wake-up delay or MOTD.
    return { status: 409 };
  }

  // Free tier: actually drive the container lifecycle.
  if (payload.action === "up") {
    try {
      const backend = await startServer(record);
      return { status: 200, backend };
    } catch (err) {
      if (err instanceof InsufficientCapacityError) {
        // No free node has room right now. mc-router's wake-timeout will
        // expire and the connecting player sees a failed connection —
        // safer than starting into an OOM risk. Worth alerting on this
        // if it happens often; it means you need more free-tier headroom.
        return { status: 503 };
      }
      throw err;
    }
  } else {
    await stopServer(record);
    return { status: 200 };
  }
}