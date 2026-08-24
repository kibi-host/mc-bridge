import { config } from "../config";
import { hasCapacity } from "../nodeCapacity";
import type { ServerRecord } from "../types";

class InsufficientCapacityError extends Error {}

async function power(
  record: ServerRecord,
  action: "start" | "stop",
): Promise<void> {
  const res = await fetch(
    `${config.panelApiUrl}/api/admin/nodes/${record.nodeId}/servers/power`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.panelApiToken}`,
      },
      body: JSON.stringify({ servers: [record.calagopusServerId], action }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Server ${action} failed (${res.status}): ${await res.text()}`,
    );
  }
}

export async function startServer(record: ServerRecord): Promise<string> {
  const ok = await hasCapacity(record.nodeId, record.memoryMb);
  if (!ok) {
    throw new InsufficientCapacityError(
      `Node ${record.nodeId} lacks capacity for ${record.serverAddress}`,
    );
  }
  await power(record, "start");
  return record.backend;
}

export async function stopServer(record: ServerRecord): Promise<void> {
  await power(record, "stop");
}

export { InsufficientCapacityError };
