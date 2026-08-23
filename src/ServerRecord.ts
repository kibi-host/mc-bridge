import { Schema, model, type InferSchemaType } from "mongoose";

const serverRecordSchema = new Schema({
  serverAddress: { type: String, required: true, unique: true, index: true },
  tier: { type: String, enum: ["paid", "free"], required: true },
  nodeId: { type: String, required: true },
  calagopusServerId: { type: String, required: true },
  memoryMb: { type: Number, required: true },
});

export type ServerRecordDoc = InferSchemaType<typeof serverRecordSchema>;
export const ServerRecordModel = model("Server.Record", serverRecordSchema);
