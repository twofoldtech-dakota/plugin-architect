import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

export function registerListProjects(server: McpServer): void {
  server.tool(
    "hive_list_projects",
    "List all tracked projects with their status and stack",
    {},
    async () => {
      let dirs: string[];
      try {
        dirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      if (dirs.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      const projects: Array<{
        name: string;
        slug: string;
        status: string;
        stack: Record<string, string>;
        description: string;
      }> = [];

      for (const dir of dirs) {
        try {
          const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
          projects.push({
            name: arch.project,
            slug: dir,
            status: arch.status,
            stack: arch.stack,
            description: arch.description,
          });
        } catch {
          // Skip directories without valid architecture
        }
      }

      if (projects.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    },
  );
}
