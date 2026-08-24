import { ServerRecordModel } from "./ServerRecord";
import type { ServerRecord } from "./types";

export async function removeServerRecord(serverAddress: string): Promise<void> {
  await ServerRecordModel.deleteOne({ serverAddress });
}

export async function saveServerRecord(record: ServerRecord): Promise<void> {
  await ServerRecordModel.findOneAndUpdate(
    { serverAddress: record.serverAddress },
    { $set: record },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export async function getServerRecord(
  serverAddress: string,
): Promise<ServerRecord | null> {
  const doc = await ServerRecordModel.findOne({ serverAddress }).lean();
  if (!doc) return null;
  return {
    serverAddress: doc.serverAddress,
    tier: doc.tier as ServerRecord["tier"],
    nodeId: doc.nodeId,
    calagopusServerId: doc.calagopusServerId,
    backend: doc.backend,
    memoryMb: doc.memoryMb,
  };
}
