export type ServerTier = "paid" | "free";

export interface ServerRecord {
  /** The Minecraft hostname players connect to, e.g. "survival.kibihost.com" */
  serverAddress: string;
  tier: ServerTier;
  /** Which node this server's container currently lives on. */
  nodeId: string;
  /** Whatever id Wings uses to identify the container/server on that node. */
  wingsServerId: string;
  /** The server's configured memory limit, for the pre-start capacity check. */
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