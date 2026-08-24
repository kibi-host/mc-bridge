import "dotenv/config";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { serve } from "@hono/node-server";
import { config } from "./config";
import { connectDb } from "./db";
import { handleScaleWebhook } from "./scaleHandler";
import { onServerProvisioned, onServerDeprovisioned } from "./provisioning";
import type { ScaleWebhookPayload, ServerRecord } from "./types";
import { syncRoutes } from "./clients/mcRouter";

await connectDb();

const app = new Hono();

try {
  await syncRoutes();
} catch (err) {
  console.error("[mc-scaler] Failed to sync routes:", err);
}

const REQUIRED_RECORD_FIELDS: (keyof ServerRecord)[] = [
  "serverAddress",
  "tier",
  "nodeId",
  "calagopusServerId",
  "backend",
  "memoryMb",
];

function parseProvisionInput(body: unknown): ServerRecord {
  if (typeof body !== "object" || body === null) {
    throw new HTTPException(400, {
      message: "Request body must be a JSON object",
    });
  }
  const b = body as Record<string, unknown>;
  for (const key of REQUIRED_RECORD_FIELDS) {
    if (b[key] === undefined) {
      throw new HTTPException(400, {
        message: `Missing required field: ${key}`,
      });
    }
  }
  if (b.tier !== "paid" && b.tier !== "free") {
    throw new HTTPException(400, {
      message: `tier must be "paid" or "free", got: ${JSON.stringify(b.tier)}`,
    });
  }
  if (typeof b.memoryMb !== "number") {
    throw new HTTPException(400, {
      message: `memoryMb must be a number, got: ${JSON.stringify(b.memoryMb)}`,
    });
  }
  return b as unknown as ServerRecord;
}

app.post("/scale", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Bearer ${config.scaleWebhookSecret}`) {
    console.warn(`Unauthorized scale webhook request: ${auth}`);
    return c.text("unauthorized", 401);
  }

  const payload = await c.req.json<ScaleWebhookPayload>();
  const result = await handleScaleWebhook(payload);

  if (config.debug) {
    console.log(
      `Scale webhook for ${payload.serverAddress} action=${payload.action} => status=${result.status} backend=${result.backend}`,
    );
  }

  if (result.status >= 200 && result.status < 300 && result.backend) {
    return c.json({ backend: result.backend }, result.status as 200);
  }
  return c.body(null, result.status as 200);
});

app.post("/internal/routes", async (c) => {
  const record = parseProvisionInput(await c.req.json());
  await onServerProvisioned(record);
  return c.body(null, 204);
});

app.delete("/internal/routes/:serverAddress", async (c) => {
  await onServerDeprovisioned(c.req.param("serverAddress"));
  return c.body(null, 204);
});

app.get("/", (c) => c.text("ok"));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  return c.json(
    { message: err instanceof Error ? err.message : "Internal server error" },
    500,
  );
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Scaler listening on ${info.port}`);
});
