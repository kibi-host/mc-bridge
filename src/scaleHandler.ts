import { getServerRecord } from "./registery/serverReg";
import {
  startServer,
  stopServer,
  InsufficientCapacityError,
  NodeStartInProgressError,
} from "./clients/panel";
import type { ScaleWebhookPayload, ScaleWebhookResult } from "./types";
import { hasCapacity } from "./nodeCapacity";

export async function handleScaleWebhook(
  payload: ScaleWebhookPayload,
): Promise<ScaleWebhookResult> {
  const record = await getServerRecord(payload.serverAddress);

  if (!record) {
    // Unknown route
    return { status: 404 };
  }

  if (record.tier === "paid") {
    if (payload.action === "up") {
      return { status: 200 };
    }
    return { status: 409 };
  }

  if (payload.action === "up") {
    try {
      const ok = await hasCapacity(record.nodeId, record.memoryMb);

      if (!ok) {
        return { status: 503 };
      }
      const backend = await startServer(record);

      return { status: 200, backend };
    } catch (err) {
      if (err instanceof InsufficientCapacityError || err instanceof NodeStartInProgressError) {
        return { status: 503 };
      }
      throw err;
    }
  } else {
    await stopServer(record);
    return { status: 200 };
  }
}
