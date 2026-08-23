export type ServerTier = "paid" | "free";

export interface ServerRecord {
  serverAddress: string;
  tier: ServerTier;
  nodeId: string;
  calagopusServerId: string;
  memoryMb: number;
}

export type ScaleAction = "up" | "down";

export interface ScaleWebhookPayload {
  action: ScaleAction;
  serverAddress: string;
  backend: string;
}

export interface ScaleWebhookResult {
  /** HTTP status to respond with. 2xx = success, anything else = mc-router
   * treats it as a failed scale attempt and (for "down") retries next idle
   * cycle without ever marking the route asleep. */
  status: number;
  /** Only meaningful for a successful "up": overrides the backend address
   * mc-router connects to, e.g. when the container woke up with a new IP. */
  backend?: string;
}