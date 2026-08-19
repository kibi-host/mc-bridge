import { registerRoute, deleteRoute } from "./clients/mcRouter.js";
 
export async function onServerProvisioned(serverAddress: string, backend: string): Promise<void> {
  await registerRoute(serverAddress, backend);
}

export async function onServerDeprovisioned(serverAddress: string): Promise<void> {
  await deleteRoute(serverAddress);
}