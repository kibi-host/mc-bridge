import { config } from "../config";
import { hasCapacity } from "../nodeCapacity";
import type { ServerRecord } from "../types";

class InsufficientCapacityError extends Error {}

export async function startServer(record: ServerRecord): Promise<string> {
  const ok = await hasCapacity(record.nodeId, record.memoryMb);
  if (!ok) {
    throw new InsufficientCapacityError(
      `Node ${record.nodeId} lacks capacity for ${record.serverAddress}`,
    );
  }

  const res = await fetch(
    `${config.panelApiUrl}/api/admin/nodes/${record.nodeId}/servers/power`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.panelApiToken}`,
      },
      body: JSON.stringify({
        servers: [record.calagopusServerId],
        action: "start",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Server start failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { host: string; port: number };
  return `${body.host}:${body.port}`;
}

export async function stopServer(record: ServerRecord): Promise<void> {
  const res = await fetch(
    `${config.panelApiUrl}/api/admin/nodes/${record.nodeId}/servers/power`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.panelApiToken}`,
      },
      body: JSON.stringify({
        servers: [record.calagopusServerId],
        action: "stop",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Server stop failed (${res.status}): ${await res.text()}`);
  }
}

export { InsufficientCapacityError };
