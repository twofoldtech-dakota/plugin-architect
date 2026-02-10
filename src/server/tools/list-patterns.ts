import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { PatternIndex } from "../types/pattern.js";

export function registerListPatterns(server: McpServer): void {
  server.tool(
    "hive_list_patterns",
    "List all registered patterns with their tags",
    {},
    async () => {
      const indexPath = join(HIVE_DIRS.patterns, "index.yaml");

      let index: PatternIndex;
      try {
        index = await readYaml<PatternIndex>(indexPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No patterns registered yet." }],
        };
      }

      if (index.patterns.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No patterns registered yet." }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(index.patterns, null, 2),
          },
        ],
      };
    },
  );
}
