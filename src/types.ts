export type ServerTier = "paid" | "free";

export interface ServerRecord {
  serverAddress: string;
  tier: ServerTier;
  nodeId: string;
  calagopusServerId: string;
  backend: string;
  memoryMb: number;
}

export type ScaleAction = "up" | "down";

export interface ScaleWebhookPayload {
  action: ScaleAction;
  serverAddress: string;
  backend: string;
}

export interface ScaleWebhookResult {
  status: number;
  backend?: string;
}

export const queueStatuses = [
  "waiting",
  "starting",
  "ready",
  "failed",
  "cancelled",
] as const;
export type QueueStatus = (typeof queueStatuses)[number];

export interface QueueState {
  queueId: string;
  serverAddress: string;
  playerUuid: string;
  createdAt: Date;
  status: QueueStatus;
  position: number | null;
  estimatedWaitSeconds: number | null;
  failureReason?: string;
  /** Present once the queue entry is ready; Velocity connects to this backend directly. */
  backend?: string;
}
