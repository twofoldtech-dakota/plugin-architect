import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dependenciesRepo } from "../storage/index.js";
import { getDb } from "../storage/db.js";

interface StalenessEntry {
  name: string;
  registered_version: string;
  latest_version: string | null;
  fetched: string;
  days_since_fetched: number;
  stale: boolean;
  update_available: boolean | null;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch { return null; }
}

export function registerCheckStaleness(server: McpServer): void {
  server.tool(
    "hive_check_staleness",
    "Check registered dependencies for staleness.",
    {
      name: z.string().optional().describe("Check a specific dependency"),
      max_age_days: z.number().optional().describe("Days before considered stale (default 90)"),
      skip_npm: z.boolean().optional().describe("Skip npm registry check"),
    },
    { readOnlyHint: true },
    async ({ name, max_age_days, skip_npm }) => {
      const threshold = max_age_days ?? 90;
      const checkNpm = !skip_npm;

      let deps = dependenciesRepo.list();
      if (name) {
        deps = deps.filter((d) => d.name === name);
        if (deps.length === 0) return { content: [{ type: "text" as const, text: `Dependency "${name}" is not registered.` }] };
      }

      if (deps.length === 0) return { content: [{ type: "text" as const, text: "No dependencies registered yet." }] };

      // Get fetched dates from db
      const db = getDb();
      const entries: StalenessEntry[] = [];

      for (const dep of deps) {
        const row = db.prepare("SELECT fetched FROM dependencies WHERE name = ?").get(dep.name) as { fetched: string } | undefined;
        const fetched = row?.fetched ?? new Date().toISOString();
        const age = daysSince(fetched);
        let latestVersion: string | null = null;
        let updateAvailable: boolean | null = null;

        if (checkNpm) {
          latestVersion = await fetchLatestVersion(dep.name);
          if (latestVersion) updateAvailable = latestVersion !== dep.version;
        }

        entries.push({
          name: dep.name,
          registered_version: dep.version,
          latest_version: latestVersion,
          fetched,
          days_since_fetched: age,
          stale: age > threshold || (updateAvailable === true),
          update_available: updateAvailable,
        });
      }

      entries.sort((a, b) => (a.stale && !b.stale ? -1 : !a.stale && b.stale ? 1 : b.days_since_fetched - a.days_since_fetched));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: entries.length,
            stale: entries.filter((e) => e.stale).length,
            updates_available: entries.filter((e) => e.update_available === true).length,
            threshold_days: threshold,
            dependencies: entries,
          }, null, 2),
        }],
      };
    },
  );
}
