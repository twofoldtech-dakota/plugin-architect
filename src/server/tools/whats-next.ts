import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { BacklogConfig, ErrorsConfig, HealthConfig, UsageConfig } from "../types/lifecycle.js";
import type { WhatsNextRecommendation } from "../types/fleet.js";

type AvailableTime = "quick" | "session" | "deep";

function effortForTime(time: AvailableTime): Set<WhatsNextRecommendation["effort"]> {
  switch (time) {
    case "quick":
      return new Set(["trivial", "small"]);
    case "session":
      return new Set(["trivial", "small", "medium"]);
    case "deep":
      return new Set(["trivial", "small", "medium", "large"]);
  }
}

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerWhatsNext(server: McpServer): void {
  server.tool(
    "hive_whats_next",
    "Get priority-scored recommendations for what to work on next across all projects. Considers errors, backlogs, health, and usage.",
    {
      available_time: z
        .enum(["quick", "session", "deep"])
        .optional()
        .default("session")
        .describe('Filter by available time: "quick" = trivial tasks, "session" = medium, "deep" = any (default: session)'),
      focus: z.string().optional().describe("Filter by project slug or area"),
    },
    async ({ available_time, focus }) => {
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      if (focus) {
        // Filter to projects matching focus
        projectDirs = projectDirs.filter((d) => d.includes(focus));
        if (projectDirs.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No projects matching "${focus}".` }],
          };
        }
      }

      const recommendations: WhatsNextRecommendation[] = [];
      const allowedEfforts = effortForTime(available_time);

      for (const dir of projectDirs) {
        const projDir = join(HIVE_DIRS.projects, dir);

        // Skip archived projects
        const arch = await safeRead<Architecture>(join(projDir, "architecture.yaml"));
        if (!arch || arch.status === "archived") continue;

        // Critical errors — highest weight
        const errors = await safeRead<ErrorsConfig>(join(projDir, "errors.yaml"));
        if (errors?.entries) {
          const criticalErrors = errors.entries.filter((e) => e.severity === "critical" && !e.resolved);
          const regularErrors = errors.entries.filter((e) => e.severity === "error" && !e.resolved);

          for (const err of criticalErrors) {
            recommendations.push({
              project: dir,
              action: `Fix critical error: ${err.message}`,
              reason: `Critical error reported on ${err.date}`,
              score: 100,
              effort: "medium",
              source: "error",
            });
          }

          if (regularErrors.length > 0) {
            recommendations.push({
              project: dir,
              action: `Resolve ${regularErrors.length} unresolved error(s)`,
              reason: "Unresolved errors accumulating",
              score: 70,
              effort: regularErrors.length > 3 ? "medium" : "small",
              source: "error",
            });
          }
        }

        // Health issues
        const health = await safeRead<HealthConfig>(join(projDir, "health.yaml"));
        if (health?.results?.length) {
          const latest = health.results[health.results.length - 1];
          if (latest.overall === "red") {
            recommendations.push({
              project: dir,
              action: "Investigate health check failure",
              reason: `Health status is RED — ${latest.checks.filter((c) => c.status === "red").map((c) => c.name).join(", ")} failing`,
              score: 90,
              effort: "medium",
              source: "health",
            });
          } else if (latest.overall === "yellow") {
            recommendations.push({
              project: dir,
              action: "Review degraded health checks",
              reason: `Health status is YELLOW — ${latest.checks.filter((c) => c.status === "yellow").map((c) => c.name).join(", ")} degraded`,
              score: 50,
              effort: "small",
              source: "health",
            });
          }
        }

        // Backlog items
        const backlog = await safeRead<BacklogConfig>(join(projDir, "backlog.yaml"));
        if (backlog?.items) {
          const criticalItems = backlog.items.filter((i) => i.priority === "critical" && i.status === "open");
          const highItems = backlog.items.filter((i) => i.priority === "high" && i.status === "open");

          for (const item of criticalItems) {
            recommendations.push({
              project: dir,
              action: `[${item.type}] ${item.title}`,
              reason: "Critical priority backlog item",
              score: 85,
              effort: item.type === "bug" ? "medium" : "large",
              source: "backlog",
            });
          }

          if (highItems.length > 0) {
            for (const item of highItems.slice(0, 3)) {
              recommendations.push({
                project: dir,
                action: `[${item.type}] ${item.title}`,
                reason: "High priority backlog item",
                score: 60,
                effort: item.type === "bug" ? "small" : "medium",
                source: "backlog",
              });
            }
          }
        }

        // Usage drops
        const usage = await safeRead<UsageConfig>(join(projDir, "usage.yaml"));
        if (usage?.trend?.direction === "down" && usage.trend.change_pct < -20) {
          recommendations.push({
            project: dir,
            action: "Investigate usage decline",
            reason: `Usage dropped ${Math.abs(usage.trend.change_pct)}% — may indicate an issue`,
            score: 55,
            effort: "small",
            source: "usage",
          });
        }
      }

      // Filter by effort
      const filtered = recommendations.filter((r) => allowedEfforts.has(r.effort));

      // Sort by score descending
      filtered.sort((a, b) => b.score - a.score);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                available_time,
                focus: focus ?? "all",
                total_recommendations: filtered.length,
                recommendations: filtered,
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
