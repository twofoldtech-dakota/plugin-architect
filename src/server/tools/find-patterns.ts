import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

export function registerFindPatterns(server: McpServer): void {
  registerAppTool(
    server,
    "hive_find_patterns",
    {
      description: "Search for relevant patterns by query (tags or keywords) and optional stack filter",
      _meta: { ui: { resourceUri: "ui://hive/pattern-gallery" } },
      inputSchema: {
        query: z.string().describe("Natural language query or tags to search for"),
        stack: z.array(z.string()).optional().describe("Filter by stack (e.g., ['typescript', 'node'])"),
      },
    },
    async ({ query, stack }) => {
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

      const queryTerms = query.toLowerCase().split(/\s+/);

      // Match by tags and keyword search against names
      const matchingSlugs = index.patterns.filter((entry) => {
        const nameWords = entry.name.toLowerCase();
        const tagMatch = entry.tags.some((t) => queryTerms.includes(t.toLowerCase()));
        const nameMatch = queryTerms.some((term) => nameWords.includes(term));
        return tagMatch || nameMatch;
      });

      if (matchingSlugs.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No patterns matching "${query}".` }],
        };
      }

      // Read full patterns and optionally filter by stack
      const results: Pattern[] = [];
      for (const entry of matchingSlugs) {
        try {
          const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
          if (stack && pattern.stack) {
            const hasStack = stack.some((s) => pattern.stack!.includes(s));
            if (!hasStack) continue;
          }
          results.push(pattern);
        } catch {
          // Skip unreadable patterns
        }
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No patterns matching "${query}" with the specified stack filter.` }],
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
