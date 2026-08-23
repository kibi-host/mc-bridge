import { config } from "./config.js";

export async function hasCapacity(
  nodeId: string,
  requiredMemoryMb: number,
): Promise<boolean> {
  const res = await fetch(
    `${config.panelApiUrl}/api/admin/nodes/${nodeId}/system/overview`,
    {
      headers: { Authorization: `Bearer ${config.panelApiToken}` },
    },
  );
  if (!res.ok) {
    // Fail closed: if we can't confirm there's room, don't gamble on it.
    return false;
  }
  const body = (await res.json()) as {
    memory: { total_bytes: number; free_bytes: number };
  };
  const requiredBytes = requiredMemoryMb * 1024 * 1024;
  return body.memory.free_bytes - requiredBytes > 0;
}
