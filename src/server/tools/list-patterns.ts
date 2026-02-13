import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { patternsRepo } from "../storage/index.js";

export function registerListPatterns(server: McpServer): void {
  server.tool(
    "hive_list_patterns",
    "List all registered patterns with their tags",
    {},
    { readOnlyHint: true },
    async () => {
      const patterns = patternsRepo.list();

      if (patterns.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No patterns registered yet." }],
        };
      }

      const summaries = patterns.map((p) => ({
        slug: p.slug,
        name: p.name,
        tags: p.tags,
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
