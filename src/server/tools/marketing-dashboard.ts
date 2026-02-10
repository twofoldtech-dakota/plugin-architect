import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { ContentPerformance, ContentPerformanceEntry } from "../types/marketing.js";

function parsePeriodDays(period: string): number {
  switch (period) {
    case "this_week":
      return 7;
    case "this_month":
      return 30;
    case "this_quarter":
      return 90;
    default:
      return 30;
  }
}

export function registerMarketingDashboard(server: McpServer): void {
  server.tool(
    "hive_marketing_dashboard",
    "View marketing analytics dashboard. Shows content performance, gaps, and messaging insights.",
    {
      period: z
        .enum(["this_week", "this_month", "this_quarter"])
        .optional()
        .default("this_month")
        .describe('Analytics period (default: "this_month")'),
      project: z.string().optional().describe("Filter by project slug"),
    },
    async ({ period, project }) => {
      const perfPath = join(HIVE_DIRS.marketingAnalytics, "content-performance.yaml");

      let performance: ContentPerformance;
      try {
        performance = await readYaml<ContentPerformance>(perfPath);
      } catch {
        performance = { entries: [] };
      }

      // Filter by period
      const days = parsePeriodDays(period);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      let filtered = performance.entries.filter((e) => e.date >= cutoffStr);

      // Filter by project if specified
      if (project) {
        filtered = filtered.filter((e) => e.project === project);
      }

      // Compute totals
      const totals = {
        content_pieces: filtered.length,
        impressions: filtered.reduce((sum, e) => sum + e.impressions, 0),
        clicks: filtered.reduce((sum, e) => sum + e.clicks, 0),
        conversions: filtered.reduce((sum, e) => sum + e.conversions, 0),
        revenue_attributed: filtered.reduce((sum, e) => sum + e.revenue_attributed, 0),
      };

      // Best performing content (by conversions)
      const sorted = [...filtered].sort((a, b) => b.conversions - a.conversions);
      const best_performing = sorted.slice(0, 5).map((e) => ({
        title: e.title,
        project: e.project,
        type: e.type,
        conversions: e.conversions,
        impressions: e.impressions,
        revenue: e.revenue_attributed,
      }));

      // Underperforming (high impressions, low conversions)
      const underperforming = filtered
        .filter((e) => e.impressions > 0 && e.conversions / e.impressions < 0.01)
        .slice(0, 5)
        .map((e) => ({
          title: e.title,
          project: e.project,
          impressions: e.impressions,
          conversions: e.conversions,
          conversion_rate: e.impressions > 0 ? ((e.conversions / e.impressions) * 100).toFixed(2) + "%" : "0%",
        }));

      // Content gaps — find projects without recent content
      const projectsWithContent = new Set(filtered.map((e) => e.project));
      let allProjects: string[] = [];
      try {
        allProjects = await readdir(HIVE_DIRS.projects);
      } catch {
        // No projects dir
      }

      const contentGaps = allProjects
        .filter((p) => !projectsWithContent.has(p))
        .map((p) => ({
          project: p,
          suggestion: `No content published for "${p}" in the last ${days} days. Consider a blog post or tutorial.`,
        }));

      // Messaging insights — analyze by type and channel
      const byType: Record<string, { impressions: number; conversions: number }> = {};
      for (const e of filtered) {
        if (!byType[e.type]) byType[e.type] = { impressions: 0, conversions: 0 };
        byType[e.type].impressions += e.impressions;
        byType[e.type].conversions += e.conversions;
      }

      const topConverting = Object.entries(byType)
        .map(([type, stats]) => ({
          type,
          conversion_rate: stats.impressions > 0 ? ((stats.conversions / stats.impressions) * 100).toFixed(2) + "%" : "0%",
          conversions: stats.conversions,
        }))
        .sort((a, b) => b.conversions - a.conversions);

      const byChannel: Record<string, { impressions: number; conversions: number }> = {};
      for (const e of filtered) {
        const ch = e.channel ?? "unknown";
        if (!byChannel[ch]) byChannel[ch] = { impressions: 0, conversions: 0 };
        byChannel[ch].impressions += e.impressions;
        byChannel[ch].conversions += e.conversions;
      }

      const topChannels = Object.entries(byChannel)
        .map(([channel, stats]) => ({
          channel,
          conversions: stats.conversions,
          impressions: stats.impressions,
        }))
        .sort((a, b) => b.conversions - a.conversions);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                totals,
                best_performing,
                underperforming,
                content_gaps: contentGaps,
                messaging_insights: {
                  top_converting_types: topConverting,
                  top_channels: topChannels,
                },
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
