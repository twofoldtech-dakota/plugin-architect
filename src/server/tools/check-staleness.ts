import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { DependencyMeta } from "../types/dependency.js";

interface StalenessEntry {
  name: string;
  registered_version: string;
  latest_version: string | null;
  fetched: string;
  days_since_fetched: number;
  stale: boolean;
  update_available: boolean | null;
  source?: string;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function registerCheckStaleness(server: McpServer): void {
  server.tool(
    "hive_check_staleness",
    "Check registered dependencies for staleness. Compares registered version against the latest published version on npm and flags outdated or old registrations.",
    {
      name: z.string().optional().describe("Check a specific dependency by name. Omit to check all."),
      max_age_days: z.number().optional().describe("Days before a registration is considered stale (default 90)"),
      skip_npm: z.boolean().optional().describe("Skip npm registry check — only use registration age (default false)"),
    },
    async ({ name, max_age_days, skip_npm }) => {
      const threshold = max_age_days ?? 90;
      const checkNpm = !skip_npm;

      let depDirs: string[];
      try {
        depDirs = await readdir(HIVE_DIRS.dependencies);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No dependencies registered yet." }],
        };
      }

      // Filter to specific dep if requested
      if (name) {
        depDirs = depDirs.filter((d) => d === name);
        if (depDirs.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Dependency "${name}" is not registered.` }],
          };
        }
      }

      const entries: StalenessEntry[] = [];

      for (const dir of depDirs) {
        let meta: DependencyMeta;
        try {
          meta = await readYaml<DependencyMeta>(join(HIVE_DIRS.dependencies, dir, "meta.yaml"));
        } catch {
          continue;
        }

        const age = daysSince(meta.fetched);
        let latestVersion: string | null = null;
        let updateAvailable: boolean | null = null;

        if (checkNpm) {
          latestVersion = await fetchLatestVersion(meta.name);
          if (latestVersion) {
            updateAvailable = latestVersion !== meta.version;
          }
        }

        entries.push({
          name: meta.name,
          registered_version: meta.version,
          latest_version: latestVersion,
          fetched: meta.fetched,
          days_since_fetched: age,
          stale: age > threshold || (updateAvailable === true),
          update_available: updateAvailable,
          source: meta.source,
        });
      }

      if (entries.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No dependencies registered yet." }],
        };
      }

      // Sort: stale first, then by age descending
      entries.sort((a, b) => {
        if (a.stale && !b.stale) return -1;
        if (!a.stale && b.stale) return 1;
        return b.days_since_fetched - a.days_since_fetched;
      });

      const staleCount = entries.filter((e) => e.stale).length;
      const updateCount = entries.filter((e) => e.update_available === true).length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total: entries.length,
                stale: staleCount,
                updates_available: updateCount,
                threshold_days: threshold,
                dependencies: entries,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
