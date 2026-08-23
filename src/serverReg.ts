import { ServerRecordModel } from "./ServerRecord";
import type { ServerRecord } from "./types";

export async function removeServerRecord(serverAddress: string): Promise<void> {
  await ServerRecordModel.deleteOne({ serverAddress });
}

export async function saveServerRecord(record: ServerRecord): Promise<void> {
  const existing = await ServerRecordModel.findOne({
    serverAddress: record.serverAddress,
  });
  if (existing) {
    existing.tier = record.tier;
    existing.nodeId = record.nodeId;
    existing.calagopusServerId = record.calagopusServerId;
    existing.memoryMb = record.memoryMb;
    await existing.save();
  } else {
    const newRecord = new ServerRecordModel(record);
    await newRecord.save();
  }
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
    memoryMb: doc.memoryMb,
  };
}
