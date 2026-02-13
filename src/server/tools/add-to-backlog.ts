import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, businessRepo } from "../storage/index.js";

export function registerAddToBacklog(server: McpServer): void {
  server.tool(
    "hive_add_to_backlog",
    "Add an item to a project's backlog. Supports bugs, improvements, ideas, and maintenance items.",
    {
      project: z.string().describe("Project slug"),
      type: z.enum(["bug", "improvement", "idea", "maintenance"]).describe("Item type"),
      title: z.string().describe("Backlog item title"),
      description: z.string().optional().describe("Detailed description"),
      priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium").describe("Priority level (default: medium)"),
      source: z.string().optional().describe("Where this item came from (e.g., 'health_check', 'user_report')"),
    },
    async ({ project, type, title, description, priority, source }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      const item = businessRepo.addBacklogItem(proj.id, {
        type,
        title,
        description,
        priority,
        status: "open",
        source,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ message: `Backlog item ${item.id} created`, item }, null, 2),
        }],
      };
    },
  );
}
