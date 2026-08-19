import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { handleScaleWebhook } from "./scaleHandler";
import { onServerProvisioned, onServerDeprovisioned } from "./provisioning";
import type { ScaleWebhookPayload } from "./types";

const app = new Hono();

// mc-router calls this on every scale-up/scale-down transition for every
// route registered on it (paid and free alike — see scaleHandler.ts for
// where the tiers diverge). Configure mc-router with:
//   -auto-scale-webhook-url http://this-service:3001/scale
//   -auto-scale-webhook-headers "Authorization=Bearer <SCALE_WEBHOOK_SECRET>"
app.post("/scale", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${config.scaleWebhookSecret}`) {
    return c.text("unauthorized", 401);
  }

  const payload = await c.req.json<ScaleWebhookPayload>();
  const result = await handleScaleWebhook(payload);

  if (result.status >= 200 && result.status < 300 && result.backend) {
    return c.json({ backend: result.backend }, result.status as 200);
  }
  return c.body(null, result.status as 200);
});

// Optional convenience endpoints if provisioning runs in a different
// process than this service — otherwise call provisioning.ts directly.
app.post("/internal/routes", async (c) => {
  const { serverAddress, backend } = await c.req.json<{ serverAddress: string; backend: string }>();
  await onServerProvisioned(serverAddress, backend);
  return c.body(null, 204);
});

app.delete("/internal/routes/:serverAddress", async (c) => {
  await onServerDeprovisioned(c.req.param("serverAddress"));
  return c.body(null, 204);
});

app.get("/health", (c) => c.text("ok"));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Bridge listening on :${info.port}`);
});