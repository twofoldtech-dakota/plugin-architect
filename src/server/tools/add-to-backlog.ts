import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { BacklogConfig, BacklogItem } from "../types/lifecycle.js";

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
      const backlogPath = join(HIVE_DIRS.projects, project, "backlog.yaml");

      let config: BacklogConfig;
      try {
        config = await readYaml<BacklogConfig>(backlogPath);
      } catch {
        config = { items: [] };
      }

      const nextId = `bl-${String(config.items.length + 1).padStart(3, "0")}`;
      const now = new Date().toISOString().split("T")[0];

      const item: BacklogItem = {
        id: nextId,
        type,
        title,
        description,
        priority,
        status: "open",
        source,
        created: now,
      };

      config.items.push(item);
      await writeYaml(backlogPath, config);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ message: `Backlog item ${nextId} created`, item }, null, 2),
          },
        ],
      };
    },
  );
}
