import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";

export function registerGetArchitecture(server: McpServer): void {
  registerAppTool(
    server,
    "hive_get_architecture",
    {
      description: "Read the current architecture doc and decisions log for a project. Call this at the start of every coding session.",
      _meta: { ui: { resourceUri: "ui://hive/architecture-viewer" } },
      inputSchema: {
        project: z.string().describe("Project slug"),
      },
    },
    async ({ project }) => {
      const projectDir = join(HIVE_DIRS.projects, safeName(project));

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(projectDir, "architecture.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      let decisions: DecisionLog = { decisions: [] };
      try {
        decisions = await readYaml<DecisionLog>(join(projectDir, "decisions.yaml"));
      } catch {
        // No decisions yet
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ architecture, decisions: decisions.decisions }, null, 2),
          },
        ],
      };
    },
  );
}
