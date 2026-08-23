import mongoose from "mongoose";
import { config } from "./config";

let connected = false;

export async function connectDb(): Promise<void> {
  if (connected) return;
  await mongoose.connect(config.mongodbUri);
  connected = true;
}
