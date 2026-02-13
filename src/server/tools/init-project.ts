import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { slugify, projectsRepo } from "../storage/index.js";

export function registerInitProject(server: McpServer): void {
  server.tool(
    "hive_init_project",
    "Initialize a new project with architecture doc and decisions log.",
    {
      name: z.string().describe("Project name"),
      description: z.string().describe("What you're building"),
      stack: z.record(z.string(), z.string()).optional().describe("Stack key-value pairs (e.g., { runtime: 'node', db: 'sqlite' })"),
    },
    async ({ name, description, stack }) => {
      const slug = slugify(name);
      const now = new Date().toISOString().split("T")[0];

      const architecture = {
        project: name,
        description,
        created: now,
        updated: now,
        status: "planning" as const,
        stack: stack ?? {},
        components: [],
        data_flows: [],
        file_structure: {},
      };

      const project = projectsRepo.create({
        slug,
        name,
        description,
        status: "planning",
        architecture,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(project.architecture, null, 2),
          },
        ],
      };
    },
  );
}
