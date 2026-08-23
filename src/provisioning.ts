import { registerRoute, deleteRoute } from "./clients/mcRouter";
import { saveServerRecord, removeServerRecord } from "./serverReg";

export async function onServerProvisioned(record: {
  serverAddress: string;
  backend: string;
  tier: "paid" | "free";
  nodeId: string;
  calagopusServerId: string;
  memoryMb: number;
}): Promise<void> {
  await saveServerRecord(record);
  await registerRoute(record.serverAddress, record.backend);
}

export async function onServerDeprovisioned(
  serverAddress: string,
): Promise<void> {
  await removeServerRecord(serverAddress);
  await deleteRoute(serverAddress);
}
