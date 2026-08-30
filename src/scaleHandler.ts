import { getServerRecord } from "./registery/serverReg";
import {
  startServer,
  stopServer,
  InsufficientCapacityError,
  NodeStartInProgressError,
} from "./clients/panel";
import type { ScaleWebhookPayload, ScaleWebhookResult } from "./types";
import { hasCapacity } from "./nodeCapacity";
import { isNodeBusy } from "./queue/queueService";

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
    // If someone else is already waiting/starting on this node, don't let a
    // fresh connection race ahead of them for the freed capacity - kick them
    // into the same queue instead. The background scheduler in
    // queueScheduler.ts processes waiting entries in strict FIFO order.
    if (await isNodeBusy(record.nodeId)) {
      return { status: 503 };
    }

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