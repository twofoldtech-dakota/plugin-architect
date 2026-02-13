import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { patternsRepo } from "../storage/index.js";

export function registerFindPatterns(server: McpServer): void {
  registerAppTool(
    server,
    "hive_find_patterns",
    {
      description: "Search for relevant patterns by query (tags or keywords) and optional stack filter",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: "ui://hive/pattern-gallery" } },
      inputSchema: {
        query: z.string().describe("Natural language query or tags to search for"),
        stack: z.array(z.string()).optional().describe("Filter by stack (e.g., ['typescript', 'node'])"),
      },
    },
    async ({ query, stack }) => {
      const queryTerms = query.toLowerCase().split(/\s+/);
      let results = patternsRepo.search(query, queryTerms);

      if (stack && stack.length > 0) {
        results = results.filter((p) => p.stack && stack.some((s) => p.stack!.includes(s)));
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No patterns matching "${query}".` }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}
