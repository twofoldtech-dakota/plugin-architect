import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dependenciesRepo } from "../storage/index.js";

export function registerCheckDependency(server: McpServer): void {
  server.tool(
    "hive_check_dependency",
    "Look up a dependency's real API surface before using it. Returns exports, common patterns, and gotchas.",
    {
      name: z.string().describe("Package name (e.g., 'drizzle-orm')"),
    },
    { readOnlyHint: true },
    async ({ name }) => {
      const dep = dependenciesRepo.getByName(name);
      if (!dep) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Dependency "${name}" is not registered. Consider registering it with hive_register_dependency.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(dep, null, 2),
          },
        ],
      };
    },
  );
}
