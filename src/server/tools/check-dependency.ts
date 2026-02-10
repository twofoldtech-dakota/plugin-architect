import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { DependencyMeta, DependencySurface } from "../types/dependency.js";

export function registerCheckDependency(server: McpServer): void {
  server.tool(
    "hive_check_dependency",
    "Look up a dependency's real API surface before using it. Returns exports, common patterns, and gotchas.",
    {
      name: z.string().describe("Package name (e.g., 'drizzle-orm')"),
    },
    async ({ name }) => {
      const depDir = join(HIVE_DIRS.dependencies, safeName(name));

      let meta: DependencyMeta;
      let surface: DependencySurface;
      try {
        meta = await readYaml<DependencyMeta>(join(depDir, "meta.yaml"));
        surface = await readYaml<DependencySurface>(join(depDir, "surface.yaml"));
      } catch {
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
            text: JSON.stringify({ meta, surface }, null, 2),
          },
        ],
      };
    },
  );
}
