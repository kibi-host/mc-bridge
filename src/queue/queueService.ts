import { QueueEntryModel, type QueueEntryDoc } from "./QueueEntry";
import type { QueueState, QueueStatus } from "../types";
import { getServerRecord } from "../registery/serverReg";

const ACTIVE_STATUSES: QueueStatus[] = ["waiting", "starting"];

function serialize(doc: QueueEntryDoc, position: number | null, estimatedWaitSeconds: number | null, backend?: string): QueueState {
  return {
    queueId: doc.queueId,
    serverAddress: doc.serverAddress,
    playerUuid: doc.playerUuid,
    createdAt: doc.createdAt,
    status: doc.status as QueueStatus,
    position,
    estimatedWaitSeconds,
    ...(doc.failureReason ? { failureReason: doc.failureReason } : {}),
    ...(backend ? { backend } : {}),
  };
}

export async function getAverageStartupSeconds(defaultSeconds: number): Promise<number> {
  const result = await QueueEntryModel.aggregate<{ average: number }>([
    { $match: { status: "ready", startingAt: { $type: "date" }, readyAt: { $type: "date" } } },
    { $sort: { readyAt: -1 } },
    { $limit: 50 },
    { $project: { duration: { $subtract: ["$readyAt", "$startingAt"] } } },
    { $group: { _id: null, average: { $avg: "$duration" } } },
  ]);
  return result[0] ? Math.max(1, Math.round(result[0].average / 1_000)) : defaultSeconds;
}

export async function getQueueState(queueId: string, defaultStartupSeconds: number): Promise<QueueState | null> {
  const entry = await QueueEntryModel.findOne({ queueId });
  if (!entry) return null;

  if (!ACTIVE_STATUSES.includes(entry.status as QueueStatus)) {
    const backend = entry.status === "ready"
      ? (await getServerRecord(entry.serverAddress))?.backend
      : undefined;
    return serialize(entry, null, null, backend);
  }

  const earlierEntries = await QueueEntryModel.countDocuments({
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { createdAt: { $lt: entry.createdAt } },
      { createdAt: entry.createdAt, _id: { $lt: entry._id } },
    ],
  });
  const position = earlierEntries + 1;
  const average = await getAverageStartupSeconds(defaultStartupSeconds);
  const elapsed = entry.startingAt ? Math.floor((Date.now() - entry.startingAt.getTime()) / 1_000) : 0;
  const estimatedWaitSeconds = entry.status === "starting"
    ? Math.max(0, average - elapsed)
    : average * position;
  return serialize(entry, position, estimatedWaitSeconds);
}

/** Create or resume the player's active entry for this server. */
export async function createOrResumeQueueEntry(
  serverAddress: string,
  nodeId: string,
  playerUuid: string,
): Promise<QueueEntryDoc> {
  // If another player has already initiated this server, join that startup.
  const serverIsStarting = await QueueEntryModel.exists({ serverAddress, status: "starting" });
  const activeKey = `${serverAddress}\u0000${playerUuid}`;
  const entry = await QueueEntryModel.findOneAndUpdate(
    { activeKey },
    {
      $setOnInsert: {
        serverAddress,
        nodeId,
        playerUuid,
        activeKey,
        status: serverIsStarting ? "starting" : "waiting",
        ...(serverIsStarting ? { startingAt: new Date() } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return entry;
}

/**
 * True if another free-tier server on this node is already waiting for or
 * starting on freed capacity. Used to stop a fresh connection from racing
 * ahead of players who are already queued for the same node.
 */
export async function isNodeBusy(nodeId: string): Promise<boolean> {
  return QueueEntryModel.exists({ nodeId, status: { $in: ACTIVE_STATUSES } }).then(Boolean);
}

export async function cancelQueueEntry(queueId: string): Promise<QueueEntryDoc | null> {
  return QueueEntryModel.findOneAndUpdate(
    { queueId, status: { $in: ACTIVE_STATUSES } },
    { $set: { status: "cancelled" }, $unset: { activeKey: 1 } },
    { new: true },
  );
}
