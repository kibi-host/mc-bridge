function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  mcRouterApiUrl: required("MC_ROUTER_API_URL"),
  scaleWebhookSecret: required("SCALE_WEBHOOK_SECRET"),
  mongodbUri: required("MONGODB_URI"),
  panelApiUrl: required("PANEL_API_URL"),
  panelApiToken: required("PANEL_API_TOKEN"),
};
