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