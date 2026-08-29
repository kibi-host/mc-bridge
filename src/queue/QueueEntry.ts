import { Schema, Types, model, type InferSchemaType } from "mongoose";

const queueEntrySchema = new Schema(
  {
    queueId: {
      type: String,
      required: true,
      unique: true,
      default: () => new Types.ObjectId().toString(),
    },
    serverAddress: {
      type: String,
      required: true,
      index: true,
    },
    playerUuid: {
      type: String,
      required: true,
      index: true,
    },
    activeKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ["waiting", "starting", "ready", "cancelled", "failed"],
      default: "waiting",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startingAt: {
      type: Date,
    },
    readyAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  },
);

queueEntrySchema.index({ playerUuid: 1, serverAddress: 1, status: 1 });
queueEntrySchema.index({ status: 1, createdAt: 1 });

export type QueueEntryDoc = InferSchemaType<typeof queueEntrySchema>;
export const QueueEntryModel = model("QueueEntry", queueEntrySchema);
