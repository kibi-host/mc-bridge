import net from "node:net";
import { config } from "../config";
import { InsufficientCapacityError, NodeStartInProgressError, startServer } from "../clients/panel";
import { hasCapacity } from "../nodeCapacity";
import { getServerRecord } from "../registery/serverReg";
import { QueueEntryModel, type QueueEntryDoc } from "./QueueEntry";
import { getQueueState } from "./queueService";

const nodeStarts = new Set<string>();
let running = false;

function backendEndpoint(backend: string): { host: string; port: number } {
  const endpoint = new URL(`tcp://${backend.includes(":") ? backend : `${backend}:25565`}`);
  return { host: endpoint.hostname, port: Number(endpoint.port || 25565) };
}

async function isBackendReady(backend: string): Promise<boolean> {
  let endpoint: { host: string; port: number };
  try {
    endpoint = backendEndpoint(backend);
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const socket = net.createConnection(endpoint);
    const finish = (ready: boolean) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(config.queueReadyProbeTimeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function notify(entry: QueueEntryDoc): Promise<void> {
  if (!config.velocityQueueCallbackUrl) return;
  const state = await getQueueState(entry.queueId, config.queueDefaultStartupSeconds);
  if (!state) return;
  try {
    const response = await fetch(config.velocityQueueCallbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.velocityQueueCallbackSecret
          ? { Authorization: `Bearer ${config.velocityQueueCallbackSecret}` }
          : {}),
      },
      body: JSON.stringify({ type: "queue.update", entry: state }),
    });
    if (!response.ok) console.warn(`[queue] Velocity callback returned ${response.status}`);
  } catch (error) {
    console.warn("[queue] Unable to notify Velocity:", error);
  }
}

async function updateServerEntries(serverAddress: string, update: Record<string, unknown>, status: "ready" | "failed"): Promise<void> {
  const transitioning = await QueueEntryModel.find({ serverAddress, status: "starting" });
  if (!transitioning.length) return;
  await QueueEntryModel.updateMany(
    { serverAddress, status: "starting" },
    { $set: update, $unset: { activeKey: 1 } },
  );
  const entries = await QueueEntryModel.find({ queueId: { $in: transitioning.map((entry) => entry.queueId) }, status });
  await Promise.all(entries.map(notify));
}

async function failWaitingServer(serverAddress: string, failureReason: string): Promise<void> {
  const waiting = await QueueEntryModel.find({ serverAddress, status: "waiting" });
  if (!waiting.length) return;
  await QueueEntryModel.updateMany(
    { queueId: { $in: waiting.map((entry) => entry.queueId) }, status: "waiting" },
    { $set: { status: "failed", failedAt: new Date(), failureReason }, $unset: { activeKey: 1 } },
  );
  const failed = await QueueEntryModel.find({ queueId: { $in: waiting.map((entry) => entry.queueId) }, status: "failed" });
  await Promise.all(failed.map(notify));
}

async function processStartingServers(): Promise<void> {
  const entries = await QueueEntryModel.find({ status: "starting" }).sort({ startingAt: 1 });
  const servers = new Map<string, QueueEntryDoc>();
  for (const entry of entries) if (!servers.has(entry.serverAddress)) servers.set(entry.serverAddress, entry);

  for (const [serverAddress, entry] of servers) {
    // Entries created after the first player requested this server share its
    // startup instead of causing a second power operation on the next tick.
    await QueueEntryModel.updateMany(
      { serverAddress, status: "waiting" },
      { $set: { status: "starting", startingAt: entry.startingAt ?? new Date() } },
    );
    const record = await getServerRecord(serverAddress);
    if (!record) {
      await updateServerEntries(serverAddress, { status: "failed", failedAt: new Date(), failureReason: "Server is no longer registered" }, "failed");
    } else if (await isBackendReady(record.backend)) {
      await updateServerEntries(serverAddress, { status: "ready", readyAt: new Date() }, "ready");
    } else if (entry.startingAt && Date.now() - entry.startingAt.getTime() > config.queueStartupTimeoutMs) {
      await updateServerEntries(serverAddress, { status: "failed", failedAt: new Date(), failureReason: "Server startup timed out" }, "failed");
    }
  }
}

async function startWaitingServers(): Promise<void> {
  const waiting = await QueueEntryModel.find({ status: "waiting" }).sort({ createdAt: 1, _id: 1 });
  const handledServers = new Set<string>();
  for (const entry of waiting) {
    if (handledServers.has(entry.serverAddress)) continue;
    handledServers.add(entry.serverAddress);
    const record = await getServerRecord(entry.serverAddress);
    if (!record) {
      await failWaitingServer(entry.serverAddress, "Server is no longer registered");
      continue;
    }
    const existingStart = await QueueEntryModel.exists({
      serverAddress: entry.serverAddress,
      status: "starting",
    });
    if (existingStart) {
      await QueueEntryModel.updateMany(
        { serverAddress: entry.serverAddress, status: "waiting" },
        { $set: { status: "starting", startingAt: new Date() } },
      );
      continue;
    }
    if (nodeStarts.has(record.nodeId) || !(await hasCapacity(record.nodeId, record.memoryMb))) continue;

    nodeStarts.add(record.nodeId);
    try {
      const now = new Date();
      const started = await QueueEntryModel.updateMany(
        { serverAddress: entry.serverAddress, status: "waiting" },
        { $set: { status: "starting", startingAt: now }, $unset: { failureReason: 1 } },
      );
      if (!started.modifiedCount) continue;
      try {
        await startServer(record);
        const entries = await QueueEntryModel.find({ serverAddress: entry.serverAddress, status: "starting" });
        await Promise.all(entries.map(notify));
      } catch (error) {
        if (error instanceof InsufficientCapacityError || error instanceof NodeStartInProgressError) {
          await QueueEntryModel.updateMany({ serverAddress: entry.serverAddress, status: "starting", startingAt: now }, { $set: { status: "waiting" }, $unset: { startingAt: 1 } });
        } else {
          const reason = error instanceof Error ? error.message : "Unable to start server";
          await updateServerEntries(entry.serverAddress, { status: "failed", failedAt: new Date(), failureReason: reason }, "failed");
        }
      }
    } finally {
      nodeStarts.delete(record.nodeId);
    }
  }
}

export async function runQueueScheduler(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processStartingServers();
    await startWaitingServers();
  } catch (error) {
    console.error("[queue] Scheduler failed:", error);
  } finally {
    running = false;
  }
}

export function startQueueScheduler(): void {
  void runQueueScheduler();
  setInterval(() => void runQueueScheduler(), config.queueSchedulerIntervalMs).unref();
}
