import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, businessRepo } from "../storage/index.js";

export function registerGetBacklog(server: McpServer): void {
  server.tool(
    "hive_get_backlog",
    "Get a project's backlog items with optional filters.",
    {
      project: z.string().describe("Project slug"),
      type: z.enum(["bug", "improvement", "idea", "maintenance"]).optional().describe("Filter by item type"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().describe("Filter by priority"),
      status: z.enum(["open", "in_progress", "done", "wont_fix"]).optional().default("open").describe("Filter by status (default: open)"),
    },
    { readOnlyHint: true },
    async ({ project, type, priority, status }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ entries: [], summary: { total: 0, by_type: {}, by_priority: {} }, message: `No backlog found for project "${project}".` }, null, 2),
          }],
        };
      }

      let items = businessRepo.listBacklog(proj.id, status ?? undefined);

      if (type) {
        items = items.filter((i) => i.type === type);
      }
      if (priority) {
        items = items.filter((i) => i.priority === priority);
      }

      const summary = {
        total: items.length,
        by_type: {
          bug: items.filter((i) => i.type === "bug").length,
          improvement: items.filter((i) => i.type === "improvement").length,
          idea: items.filter((i) => i.type === "idea").length,
          maintenance: items.filter((i) => i.type === "maintenance").length,
        },
        by_priority: {
          critical: items.filter((i) => i.priority === "critical").length,
          high: items.filter((i) => i.priority === "high").length,
          medium: items.filter((i) => i.priority === "medium").length,
          low: items.filter((i) => i.priority === "low").length,
        },
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ items, summary }, null, 2) }],
      };
    },
  );
}
