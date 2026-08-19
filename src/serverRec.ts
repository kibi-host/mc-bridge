import { Schema, model, type InferSchemaType } from "mongoose";
 
/**
 * A standalone collection so this service stays decoupled from your real
 * Server schema (plugin, not a merge). If you'd rather keep a single
 * source of truth, drop this file and point serverRegistry.ts at your
 * existing Server model instead — the four fields below are all it needs.
 */
const serverRecordSchema = new Schema({
  serverAddress: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: ["paid", "free"], required: true },
  nodeId: { type: String, required: true },
  wingsServerId: { type: String, required: true },
  memoryMb: { type: Number, required: true },
});
 
export type ServerRecordDoc = InferSchemaType<typeof serverRecordSchema>;
export const ServerRecordModel = model("ScalerServerRecord", serverRecordSchema);
 