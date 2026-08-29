import { config } from "../config";
import { hasCapacity } from "../nodeCapacity";
import type { ServerRecord } from "../types";

class InsufficientCapacityError extends Error {}
class NodeStartInProgressError extends Error {}
const startingNodes = new Set<string>();

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
  if (startingNodes.has(record.nodeId)) {
    throw new NodeStartInProgressError(`A server is already starting on node ${record.nodeId}`);
  }
  startingNodes.add(record.nodeId);
  try {
    // Capacity must be checked while the node-start lock is held: two power
    // operations otherwise can both pass the check and overcommit the node.
    const ok = await hasCapacity(record.nodeId, record.memoryMb);
    if (!ok) {
      throw new InsufficientCapacityError(
        `Node ${record.nodeId} lacks capacity for ${record.serverAddress}`,
      );
    }
    await power(record, "start");
    return record.backend;
  } finally {
    startingNodes.delete(record.nodeId);
  }
}

export async function stopServer(record: ServerRecord): Promise<void> {
  await power(record, "stop");
}

export { InsufficientCapacityError, NodeStartInProgressError };
