import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { projectsRepo, decisionsRepo } from "../storage/index.js";

export function registerGetArchitecture(server: McpServer): void {
  registerAppTool(
    server,
    "hive_get_architecture",
    {
      description: "Read the current architecture doc and decisions log for a project. Call this at the start of every coding session.",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: "ui://hive/architecture-viewer" } },
      inputSchema: {
        project: z.string().describe("Project slug"),
      },
    },
    async ({ project }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const decisions = decisionsRepo.listByProject(proj.id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ architecture: proj.architecture, decisions }, null, 2),
          },
        ],
      };
    },
  );
}
