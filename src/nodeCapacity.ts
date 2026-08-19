import { config } from "./config.js";

/**
 * INTEGRATION SEAM — best guess, needs confirming against your panel's
 * own API Reference (the button in the panel header generates a live
 * OpenAPI page per your install, which I can't see from here). I don't
 * have a confirmed public endpoint for live node utilization, so treat
 * the path below as a starting point, not a known-good value.
 *
 * The point of this function: Calagopus's node "memory" setting is an
 * allocation ceiling checked at server *creation* time, not a live
 * physical-usage check at *start* time (see the OOM discussion earlier
 * in this thread). Starting one more server on an already-full node can
 * OOM-kill an unrelated running server, not just fail the one you're
 * starting. This function is what stands in for the check Wings doesn't
 * reliably do — call it before every free-tier start.
 */
export async function hasCapacity(nodeId: string, requiredMemoryMb: number): Promise<boolean> {
  const res = await fetch(`${config.wingsApiUrl}/api/admin/nodes/${nodeId}/resources`, {
    headers: { Authorization: `Bearer ${config.wingsApiToken}` },
  });
  if (!res.ok) {
    // Fail closed: if we can't confirm there's room, don't gamble on it.
    return false;
  }
  const body = (await res.json()) as { memoryTotalMb: number; memoryUsedMb: number };
  const headroomMb = body.memoryTotalMb - body.memoryUsedMb;
  // Leave a margin rather than cutting it exactly to zero.
  return headroomMb - requiredMemoryMb > 512;
}