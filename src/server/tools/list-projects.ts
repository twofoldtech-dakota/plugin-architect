import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectsRepo } from "../storage/index.js";

export function registerListProjects(server: McpServer): void {
  server.tool(
    "hive_list_projects",
    "List all tracked projects with their status and stack",
    {},
    async () => {
      const projects = projectsRepo.list();

      if (projects.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      const summaries = projects.map((p) => ({
        name: p.name,
        slug: p.slug,
        status: p.architecture.status,
        stack: p.architecture.stack,
        description: p.description,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summaries, null, 2),
          },
        ],
      };
    },
  );
}
