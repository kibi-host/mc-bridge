import { config } from "../config";
import { ServerRecordModel } from "../ServerRecord";

export async function registerRoute(
  serverAddress: string,
  backend: string,
): Promise<void> {
  const res = await fetch(`${config.mcRouterApiUrl}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverAddress, backend }),
  });
  if (!res.ok) {
    throw new Error(
      `mc-router registerRoute failed (${res.status}): ${await res.text()}`,
    );
  }
}

export async function deleteRoute(serverAddress: string): Promise<void> {
  const res = await fetch(
    `${config.mcRouterApiUrl}/routes/${encodeURIComponent(serverAddress)}`,
    {
      method: "DELETE",
    },
  );
  // mc-router returns 404 if the route is already gone
  if (!res.ok && res.status !== 404) {
    throw new Error(
      `mc-router deleteRoute failed (${res.status}): ${await res.text()}`,
    );
  }
}

export async function listRoutes(): Promise<
  Record<string, { backend: string; scalingTarget: string }>
> {
  const res = await fetch(`${config.mcRouterApiUrl}/routes`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `mc-router listRoutes failed (${res.status}): ${await res.text()}`,
    );
  }
  return (await res.json()) as Record<
    string,
    { backend: string; scalingTarget: string }
  >;
}

export async function syncRoutes(): Promise<void> {
  const records = await ServerRecordModel.find().lean();

  console.log(`Syncing ${records.length} routes to mc-router...`);

  for (const record of records) {
    try {
      await registerRoute(record.serverAddress, record.backend);

      console.log(`Registered ${record.serverAddress} → ${record.backend}`);
    } catch (err) {
      console.error(
        `Failed to register ${record.serverAddress} → ${record.backend}:`,
        err,
      );
    }
  }

  console.log("Route sync complete");
}
