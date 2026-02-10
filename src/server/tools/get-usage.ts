import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { UsageConfig, UsageEntry, UsageTrend } from "../types/lifecycle.js";

const execAsync = promisify(exec);

function parsePeriodDays(period: string): number {
  const match = period.match(/^(\d+)d$/);
  return match ? parseInt(match[1], 10) : 7;
}

function computeTrend(entries: UsageEntry[]): UsageTrend {
  if (entries.length < 2) {
    return { direction: "flat", change_pct: 0 };
  }

  // Compare first half vs second half
  const mid = Math.floor(entries.length / 2);
  const firstHalf = entries.slice(0, mid);
  const secondHalf = entries.slice(mid);

  const avgFirst = firstHalf.reduce((sum, e) => sum + (e.requests ?? e.visitors ?? 0), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, e) => sum + (e.requests ?? e.visitors ?? 0), 0) / secondHalf.length;

  if (avgFirst === 0) {
    return { direction: avgSecond > 0 ? "up" : "flat", change_pct: avgSecond > 0 ? 100 : 0 };
  }

  const change_pct = Math.round(((avgSecond - avgFirst) / avgFirst) * 100);

  let direction: "up" | "down" | "flat";
  if (change_pct > 5) direction = "up";
  else if (change_pct < -5) direction = "down";
  else direction = "flat";

  return { direction, change_pct };
}

export function registerGetUsage(server: McpServer): void {
  server.tool(
    "hive_get_usage",
    "Get usage data for a project. Supports period filtering and trend computation.",
    {
      project: z.string().describe("Project slug"),
      period: z.enum(["7d", "30d", "90d"]).optional().default("7d").describe("Time period to analyze (default: 7d)"),
    },
    async ({ project, period }) => {
      const usagePath = join(HIVE_DIRS.projects, project, "usage.yaml");

      let config: UsageConfig;
      try {
        config = await readYaml<UsageConfig>(usagePath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No usage.yaml found for project "${project}".`,
                  setup: {
                    message: "Create usage.yaml in your project directory with this structure:",
                    example: {
                      source_command: "curl -s https://api.example.com/stats | jq '.requests, .visitors'",
                      entries: [],
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Pull fresh usage if source_command is configured
      if (config.source_command) {
        try {
          const { stdout } = await execAsync(config.source_command, { timeout: 30000 });
          const output = stdout.trim();

          // Try to parse as JSON
          try {
            const data = JSON.parse(output);
            const entry: UsageEntry = {
              date: new Date().toISOString().split("T")[0],
              requests: data.requests ?? undefined,
              visitors: data.visitors ?? undefined,
              error_rate: data.error_rate ?? undefined,
              custom: data.custom ?? undefined,
            };

            // Only add if we don't already have an entry for today
            const today = entry.date;
            if (!config.entries.some((e) => e.date === today)) {
              config.entries.push(entry);
            }
          } catch {
            // Non-JSON output — skip
          }

          await writeYaml(usagePath, config);
        } catch {
          // Source command failed — continue with existing entries
        }
      }

      // Filter by period
      const days = parsePeriodDays(period);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      const filtered = config.entries.filter((e) => e.date >= cutoffStr);

      // Compute trend
      const trend = computeTrend(filtered);
      config.trend = trend;
      await writeYaml(usagePath, config);

      // Compute summary
      const totalRequests = filtered.reduce((sum, e) => sum + (e.requests ?? 0), 0);
      const totalVisitors = filtered.reduce((sum, e) => sum + (e.visitors ?? 0), 0);
      const errorRates = filtered.filter((e) => e.error_rate !== undefined).map((e) => e.error_rate!);
      const avgErrorRate = errorRates.length > 0 ? Math.round((errorRates.reduce((a, b) => a + b, 0) / errorRates.length) * 100) / 100 : 0;
      const daysWithData = filtered.length || 1;

      const summary = {
        avg_daily_requests: Math.round(totalRequests / daysWithData),
        avg_daily_visitors: Math.round(totalVisitors / daysWithData),
        avg_error_rate: avgErrorRate,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ entries: filtered, trend, summary, period }, null, 2),
          },
        ],
      };
    },
  );
}
