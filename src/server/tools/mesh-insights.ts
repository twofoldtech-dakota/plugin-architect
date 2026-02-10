import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { MeshIdentity, SharedPattern, SharedAntiPattern, SharedBenchmark } from "../types/mesh.js";
import type { Architecture } from "../types/architecture.js";

function matchesTags(itemTags: string[], filterTags: string[]): boolean {
  if (filterTags.length === 0) return true;
  const lower = filterTags.map((t) => t.toLowerCase());
  return itemTags.some((t) => lower.includes(t.toLowerCase()));
}

function matchesStack(itemStack: string[] | undefined, projectStack: string[]): boolean {
  if (!itemStack || itemStack.length === 0) return true;
  if (projectStack.length === 0) return true;
  const lower = projectStack.map((s) => s.toLowerCase());
  return itemStack.some((s) => lower.includes(s.toLowerCase()));
}

async function readAllInDir<T>(dir: string): Promise<T[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const results: T[] = [];
  for (const f of files) {
    if (!f.endsWith(".yaml")) continue;
    try {
      results.push(await readYaml<T>(join(dir, f)));
    } catch {
      continue;
    }
  }
  return results;
}

export function registerMeshInsights(server: McpServer): void {
  server.tool(
    "hive_mesh_insights",
    "Get insights from the Hive Mesh network. Returns relevant patterns, anti-patterns to watch, and stack benchmarks from the mesh, filtered by your project context.",
    {
      context: z.object({
        project: z.string().optional().describe("Project slug to match context against"),
        tags: z.array(z.string()).optional().describe("Tags to filter by"),
        type: z.enum(["patterns", "anti_patterns", "benchmarks", "all"]).optional().describe("Type of insights to return"),
      }).optional().describe("Filter context for insights"),
    },
    async ({ context }) => {
      // Verify mesh connection
      try {
        const identity = await readYaml<MeshIdentity>(join(HIVE_DIRS.mesh, "identity.yaml"));
        if (identity.status !== "connected") {
          return {
            content: [{ type: "text" as const, text: "Mesh is disconnected. Reconnect with hive_mesh_connect." }],
            isError: true,
          };
        }
      } catch {
        return {
          content: [{ type: "text" as const, text: "Not connected to mesh. Use hive_mesh_connect with action 'join' first." }],
          isError: true,
        };
      }

      const filterType = context?.type ?? "all";
      const filterTags = context?.tags ?? [];
      let projectStack: string[] = [];

      // Load project stack for context matching
      if (context?.project) {
        try {
          const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, context.project, "architecture.yaml"));
          projectStack = Object.values(arch.stack).map((v) => v.toLowerCase());
        } catch {
          // Project not found — continue without stack filter
        }
      }

      const result: {
        relevant_patterns: Array<SharedPattern & { compatibility: string }>;
        anti_patterns_to_watch: Array<SharedAntiPattern & { applies_to_you: boolean }>;
        stack_benchmarks: Array<{
          stack: string[];
          avg_satisfaction: number;
          pain_points: string[];
          praise: string[];
          migration_targets: string[];
        }>;
        recommendations: string[];
      } = {
        relevant_patterns: [],
        anti_patterns_to_watch: [],
        stack_benchmarks: [],
        recommendations: [],
      };

      // Patterns
      if (filterType === "all" || filterType === "patterns") {
        const patterns = await readAllInDir<SharedPattern>(HIVE_DIRS.meshInboundPatterns);
        for (const p of patterns) {
          if (!matchesTags(p.tags, filterTags)) continue;
          const stackMatch = matchesStack(p.stack, projectStack);
          result.relevant_patterns.push({
            ...p,
            compatibility: stackMatch ? "compatible" : "unknown",
          });
        }
        // Sort by adoptions descending
        result.relevant_patterns.sort((a, b) => b.adoptions - a.adoptions);
      }

      // Anti-patterns
      if (filterType === "all" || filterType === "anti_patterns") {
        const antiPatterns = await readAllInDir<SharedAntiPattern>(HIVE_DIRS.meshInboundAntiPatterns);
        for (const ap of antiPatterns) {
          if (!matchesTags(ap.tags, filterTags)) continue;
          const appliesToYou = matchesStack(ap.tags, projectStack);
          result.anti_patterns_to_watch.push({
            ...ap,
            applies_to_you: appliesToYou,
          });
        }
        // Sort: applies to you first, then by severity
        const severityOrder = { critical: 0, warning: 1, minor: 2 };
        result.anti_patterns_to_watch.sort((a, b) => {
          if (a.applies_to_you !== b.applies_to_you) return a.applies_to_you ? -1 : 1;
          return severityOrder[a.severity] - severityOrder[b.severity];
        });
      }

      // Benchmarks
      if (filterType === "all" || filterType === "benchmarks") {
        const benchmarks = await readAllInDir<SharedBenchmark>(HIVE_DIRS.meshInboundBenchmarks);

        // Aggregate benchmarks by stack signature
        const stackGroups = new Map<string, SharedBenchmark[]>();
        for (const b of benchmarks) {
          const key = [...b.stack].sort().join(",");
          const group = stackGroups.get(key) ?? [];
          group.push(b);
          stackGroups.set(key, group);
        }

        for (const [_key, group] of stackGroups) {
          const avgSatisfaction = group.reduce((sum, b) => sum + b.satisfaction, 0) / group.length;
          const allPainPoints = [...new Set(group.flatMap((b) => b.pain_points))];
          const allPraise = [...new Set(group.flatMap((b) => b.praise))];
          const migrationTargets = [...new Set(group.flatMap((b) => b.migration_to ?? []))];

          result.stack_benchmarks.push({
            stack: group[0].stack,
            avg_satisfaction: Math.round(avgSatisfaction * 10) / 10,
            pain_points: allPainPoints,
            praise: allPraise,
            migration_targets: migrationTargets,
          });
        }

        // Sort by satisfaction descending
        result.stack_benchmarks.sort((a, b) => b.avg_satisfaction - a.avg_satisfaction);
      }

      // Generate recommendations
      if (result.relevant_patterns.length > 0) {
        const compatible = result.relevant_patterns.filter((p) => p.compatibility === "compatible");
        if (compatible.length > 0) {
          result.recommendations.push(`${compatible.length} compatible pattern(s) available from the mesh — consider adopting high-adoption ones.`);
        }
      }

      if (result.anti_patterns_to_watch.length > 0) {
        const critical = result.anti_patterns_to_watch.filter((ap) => ap.applies_to_you && ap.severity === "critical");
        if (critical.length > 0) {
          result.recommendations.push(`${critical.length} critical anti-pattern(s) affect your stack — review immediately.`);
        }
      }

      if (result.stack_benchmarks.length > 0) {
        const lowSatisfaction = result.stack_benchmarks.filter((b) =>
          b.avg_satisfaction < 3 && matchesStack(b.stack, projectStack),
        );
        if (lowSatisfaction.length > 0) {
          result.recommendations.push(`Some stacks in your project have low satisfaction ratings on the mesh — review pain points.`);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
