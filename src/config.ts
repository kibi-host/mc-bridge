function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  debug: process.env.DEBUG,
  port: Number(process.env.PORT ?? 3001),
  mcRouterApiUrl: required("MC_ROUTER_API_URL"),
  scaleWebhookSecret: required("SCALE_WEBHOOK_SECRET"),
  // Until Velocity has its own secret configured, it uses the existing
  // service-to-service secret. Deployments should set QUEUE_API_SECRET.
  queueApiSecret: process.env.QUEUE_API_SECRET ?? required("SCALE_WEBHOOK_SECRET"),
  mongodbUri: required("MONGODB_URI"),
  panelApiUrl: required("PANEL_API_URL"),
  panelApiToken: required("PANEL_API_TOKEN"),
  queueSchedulerIntervalMs: Number(process.env.QUEUE_SCHEDULER_INTERVAL_MS ?? 5_000),
  queueStartupTimeoutMs: Number(process.env.QUEUE_STARTUP_TIMEOUT_MS ?? 10 * 60_000),
  queueDefaultStartupSeconds: Number(process.env.QUEUE_DEFAULT_STARTUP_SECONDS ?? 90),
  queueReadyProbeTimeoutMs: Number(process.env.QUEUE_READY_PROBE_TIMEOUT_MS ?? 3_000),
  // This is deliberately configured server-side rather than accepted from the
  // queue API, so a player cannot use the scaler as an arbitrary webhook client.
  velocityQueueCallbackUrl: process.env.VELOCITY_QUEUE_CALLBACK_URL,
  velocityQueueCallbackSecret: process.env.VELOCITY_QUEUE_CALLBACK_SECRET,
};
