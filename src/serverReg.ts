import { ServerRecordModel } from "./models/serverRecord.js";
import type { ServerRecord } from "./types.js";
 
/**
 * Calagopus itself has no concept of "hostname" — servers are addressed
 * by UUID and reached via an IP:port allocation. The hostname->server
 * mapping only exists in your world (the subdomain you hand out at
 * signup), so this is a plain lookup against your own DB, not a call to
 * the panel. Keep it fast — it's on the hot path for every free-tier
 * wake-up and every paid-tier "up" no-op.
 */
export async function getServerRecord(serverAddress: string): Promise<ServerRecord | null> {
  const doc = await ServerRecordModel.findOne({ serverAddress }).lean();
  if (!doc) return null;
  return {
    serverAddress: doc.serverAddress,
    tier: doc.tier as ServerRecord["tier"],
    nodeId: doc.nodeId,
    wingsServerId: doc.wingsServerId,
    memoryMb: doc.memoryMb,
  };
}
 