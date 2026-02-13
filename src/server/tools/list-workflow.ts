import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { workflowRepo } from "../storage/index.js";

function periodToSince(period: string): string | undefined {
  const now = new Date();
  switch (period) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "yesterday": {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "this_week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    default:
      return undefined;
  }
}

function periodToUntil(period: string): string | undefined {
  if (period !== "yesterday") return undefined;
  const now = new Date();
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  return end.toISOString();
}

export function registerListWorkflow(server: McpServer): void {
  server.tool(
    "hive_list_workflow",
    "Query workflow journal entries with filters. Returns entries and summary stats.",
    {
      type: z.enum(["conversation_summary", "learning", "accomplishment", "note"]).optional().describe("Filter by entry type"),
      project: z.string().optional().describe("Filter by project slug"),
      tag: z.string().optional().describe("Filter by tag"),
      period: z.enum(["today", "yesterday", "this_week", "this_month", "all"]).optional().default("all").describe("Time period filter"),
      published: z.boolean().optional().describe("Filter by published status"),
      limit: z.number().optional().default(50).describe("Max entries to return"),
    },
    async ({ type, project, tag, period, published, limit }) => {
      const since = periodToSince(period ?? "all");
      const until = periodToUntil(period ?? "all");

      const entries = workflowRepo.list({
        type,
        project,
        tag,
        since,
        until,
        published,
        limit: limit ?? 50,
      });

      // Build summary stats
      const countsByType: Record<string, number> = {};
      const countsByProject: Record<string, number> = {};
      const moods: Record<string, number> = {};
      let publishedCount = 0;

      for (const e of entries) {
        countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
        if (e.project) {
          countsByProject[e.project] = (countsByProject[e.project] ?? 0) + 1;
        }
        if (e.mood) {
          moods[e.mood] = (moods[e.mood] ?? 0) + 1;
        }
        if (e.published) publishedCount++;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total: entries.length,
            period: period ?? "all",
            entries,
            summary: {
              by_type: countsByType,
              by_project: countsByProject,
              moods,
              published: publishedCount,
            },
          }, null, 2),
        }],
      };
    },
  );
}
