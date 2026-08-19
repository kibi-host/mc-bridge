import { config } from "../config.js";
 
/**
 * Registers (or updates) a route on mc-router.
 * Call this from your provisioning flow right after a server is created
 * and its node/port are known — regardless of which tier it is.
 */
export async function registerRoute(serverAddress: string, backend: string): Promise<void> {
  const res = await fetch(`${config.mcRouterApiUrl}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverAddress, backend }),
  });
  if (!res.ok) {
    throw new Error(`mc-router registerRoute failed (${res.status}): ${await res.text()}`);
  }
}
 
/**
 * Removes a route. Call this when a server is deleted, regardless of tier.
 */
export async function deleteRoute(serverAddress: string): Promise<void> {
  const res = await fetch(`${config.mcRouterApiUrl}/routes/${encodeURIComponent(serverAddress)}`, {
    method: "DELETE",
  });
  // mc-router returns 404 if the route is already gone — treat that as fine.
  if (!res.ok && res.status !== 404) {
    throw new Error(`mc-router deleteRoute failed (${res.status}): ${await res.text()}`);
  }
}
 
export async function listRoutes(): Promise<Record<string, { backend: string; scalingTarget: string }>> {
  const res = await fetch(`${config.mcRouterApiUrl}/routes`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`mc-router listRoutes failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as Record<string, { backend: string; scalingTarget: string }>;
}