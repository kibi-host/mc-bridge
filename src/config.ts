function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  mcRouterApiUrl: required(process.env.MC_ROUTER_API_URL),
  scaleWebhookSecret: required(process.env.SCALE_WEBHOOK_SECRET),
  wingsApiUrl: required(process.env.WINGS_API_URL),
  wingsApiToken: required(process.env.WINGS_API_TOKEN),
  panelApiUrl: required(process.env.PANEL_API_URL),
  panelApiToken: required(process.env.PANEL_API_TOKEN),
};
