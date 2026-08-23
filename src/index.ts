import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config";
import { connectDb } from "./db";
import { handleScaleWebhook } from "./scaleHandler";
import { onServerProvisioned, onServerDeprovisioned } from "./provisioning";
import type { ScaleWebhookPayload } from "./types";

await connectDb();

const app = new Hono();

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

app.post("/internal/routes", async (c) => {
  const record = await c.req.json<{
    serverAddress: string;
    backend: string;
    tier: "paid" | "free";
    nodeId: string;
    calagopusServerId: string;
    memoryMb: number;
  }>();

  await onServerProvisioned(record);
  return c.body(null, 204);
});

app.delete("/internal/routes/:serverAddress", async (c) => {
  await onServerDeprovisioned(c.req.param("serverAddress"));
  return c.body(null, 204);
});

app.get("/", (c) => c.text("ok"));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Scaler listening on ${info.port}`);
});
