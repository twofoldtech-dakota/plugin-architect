import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";
import type { Architecture } from "../types/architecture.js";

interface PatternSuggestion {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  stack_overlap: string[];
  usage_count: number;
  confidence: "high" | "medium" | "low";
}

function computeConfidence(usageCount: number, stackOverlap: number): "high" | "medium" | "low" {
  if (usageCount >= 3 && stackOverlap >= 2) return "high";
  if (usageCount >= 1 || stackOverlap >= 2) return "medium";
  return "low";
}

export function registerSuggestPatterns(server: McpServer): void {
  server.tool(
    "hive_suggest_patterns",
    "Auto-suggest patterns that match a project's stack. Reads the project architecture to determine the stack, then finds patterns with overlapping stack/tags. Useful when starting or expanding a project.",
    {
      project: z.string().optional().describe("Project slug — reads stack from architecture. Omit if providing stack directly."),
      stack: z.array(z.string()).optional().describe("Stack keywords to match against (e.g., ['typescript', 'next', 'drizzle']). Overrides project stack if both provided."),
    },
    async ({ project, stack }) => {
      // Resolve stack keywords
      let stackTerms: string[] = stack ?? [];

      if (project && stackTerms.length === 0) {
        try {
          const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, safeName(project), "architecture.yaml"));
          // Collect stack values (e.g., { runtime: "node", framework: "next" } → ["node", "next"])
          stackTerms = Object.values(arch.stack).map((v) => v.toLowerCase());
          // Also add component types as hints
          for (const comp of arch.components) {
            if (comp.type) stackTerms.push(comp.type.toLowerCase());
          }
        } catch {
          return {
            content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
            isError: true,
          };
        }
      }

      if (stackTerms.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Provide a project slug or stack keywords to get suggestions." }],
          isError: true,
        };
      }

      const lowerTerms = stackTerms.map((t) => t.toLowerCase());

      // Read pattern index
      let index: PatternIndex;
      try {
        index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
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

      // Score each pattern by stack overlap
      const suggestions: PatternSuggestion[] = [];

      for (const entry of index.patterns) {
        let pattern: Pattern;
        try {
          pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
        } catch {
          continue;
        }

        // Compute stack overlap
        const patternTerms = [
          ...entry.tags.map((t) => t.toLowerCase()),
          ...(pattern.stack ?? []).map((s) => s.toLowerCase()),
        ];
        const overlap = lowerTerms.filter((t) => patternTerms.includes(t));

        if (overlap.length === 0) continue;

        const usageCount = pattern.used_in?.length ?? 0;
        suggestions.push({
          slug: entry.slug,
          name: entry.name,
          description: pattern.description,
          tags: entry.tags,
          stack_overlap: overlap,
          usage_count: usageCount,
          confidence: computeConfidence(usageCount, overlap.length),
        });
      }

      if (suggestions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No patterns match the stack [${lowerTerms.join(", ")}]. Consider registering patterns as you build.`,
            },
          ],
        };
      }

      // Sort: high confidence first, then by usage count, then by overlap size
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      suggestions.sort(
        (a, b) =>
          confidenceOrder[b.confidence] - confidenceOrder[a.confidence] ||
          b.usage_count - a.usage_count ||
          b.stack_overlap.length - a.stack_overlap.length,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                stack: lowerTerms,
                suggestions_count: suggestions.length,
                suggestions,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
