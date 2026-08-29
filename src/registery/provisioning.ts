import { registerRoute, deleteRoute } from "../clients/mcRouter";
import { saveServerRecord, removeServerRecord } from "./serverReg";
import type { ServerRecord } from "../types";

export async function onServerProvisioned(record: ServerRecord): Promise<void> {
  await saveServerRecord(record);
  await registerRoute(record.serverAddress, record.backend);
}

export async function onServerDeprovisioned(
  serverAddress: string,
): Promise<void> {
  await removeServerRecord(serverAddress);
  await deleteRoute(serverAddress);
}
