import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { DependencyMeta } from "../types/dependency.js";

interface DepScanResult {
  package: string;
  registered_version: string;
  latest_version: string | null;
  outdated: boolean;
  affected_projects: string[];
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

export function registerFleetScanDeps(server: McpServer): void {
  server.tool(
    "hive_fleet_scan_deps",
    "Scan fleet dependencies for outdated packages. Cross-references registered dependencies with project architectures.",
    {
      package: z.string().optional().describe("Check a specific package name. Omit to check all."),
      severity: z.enum(["critical", "high", "moderate", "low"]).optional().describe("Minimum vulnerability severity to flag"),
    },
    async ({ package: packageName }) => {
      // Read registered dependencies
      let depDirs: string[];
      try {
        depDirs = await readdir(HIVE_DIRS.dependencies);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No dependencies registered." }],
        };
      }

      if (packageName) {
        depDirs = depDirs.filter((d) => d === packageName);
        if (depDirs.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Dependency "${packageName}" is not registered.` }],
          };
        }
      }

      // Read all project architectures to find dep usage
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        projectDirs = [];
      }

      // Build a map of dep name -> projects using it
      const depProjects = new Map<string, string[]>();
      for (const projDir of projectDirs) {
        try {
          const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, projDir, "architecture.yaml"));
          if (!arch.stack) continue;
          // Check if dep name appears in stack values or component dependencies
          const stackValues = Object.values(arch.stack).map((v) => String(v).toLowerCase());
          const componentDeps = (arch.components ?? []).flatMap((c) => c.dependencies ?? []).map((d) => d.toLowerCase());
          const allRefs = [...stackValues, ...componentDeps];

          for (const dep of depDirs) {
            if (allRefs.some((ref) => ref.includes(dep.toLowerCase()))) {
              const existing = depProjects.get(dep) ?? [];
              existing.push(projDir);
              depProjects.set(dep, existing);
            }
          }
        } catch {
          // Skip unreadable projects
        }
      }

      const results: DepScanResult[] = [];

      for (const dir of depDirs) {
        let meta: DependencyMeta;
        try {
          meta = await readYaml<DependencyMeta>(join(HIVE_DIRS.dependencies, dir, "meta.yaml"));
        } catch {
          continue;
        }

        const latestVersion = await fetchLatestVersion(meta.name);
        const outdated = latestVersion !== null && latestVersion !== meta.version;

        results.push({
          package: meta.name,
          registered_version: meta.version,
          latest_version: latestVersion,
          outdated,
          affected_projects: depProjects.get(dir) ?? [],
        });
      }

      // Sort: outdated first
      results.sort((a, b) => {
        if (a.outdated && !b.outdated) return -1;
        if (!a.outdated && b.outdated) return 1;
        return a.package.localeCompare(b.package);
      });

      const outdatedCount = results.filter((r) => r.outdated).length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total_scanned: results.length,
                outdated: outdatedCount,
                up_to_date: results.length - outdatedCount,
                packages: results,
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
