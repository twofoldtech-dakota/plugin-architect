import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { BacklogConfig } from "../types/lifecycle.js";

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
    async ({ project, type, priority, status }) => {
      const backlogPath = join(HIVE_DIRS.projects, safeName(project), "backlog.yaml");

      let config: BacklogConfig;
      try {
        config = await readYaml<BacklogConfig>(backlogPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { entries: [], summary: { total: 0, by_type: {}, by_priority: {} }, message: `No backlog found for project "${project}".` },
                null,
                2,
              ),
            },
          ],
        };
      }

      let filtered = config.items;

      if (type) {
        filtered = filtered.filter((i) => i.type === type);
      }

      if (priority) {
        filtered = filtered.filter((i) => i.priority === priority);
      }

      if (status) {
        filtered = filtered.filter((i) => i.status === status);
      }

      const summary = {
        total: filtered.length,
        by_type: {
          bug: filtered.filter((i) => i.type === "bug").length,
          improvement: filtered.filter((i) => i.type === "improvement").length,
          idea: filtered.filter((i) => i.type === "idea").length,
          maintenance: filtered.filter((i) => i.type === "maintenance").length,
        },
        by_priority: {
          critical: filtered.filter((i) => i.priority === "critical").length,
          high: filtered.filter((i) => i.priority === "high").length,
          medium: filtered.filter((i) => i.priority === "medium").length,
          low: filtered.filter((i) => i.priority === "low").length,
        },
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ items: filtered, summary }, null, 2),
          },
        ],
      };
    },
  );
}
