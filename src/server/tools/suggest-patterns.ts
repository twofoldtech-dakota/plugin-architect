import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, patternsRepo } from "../storage/index.js";

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
    "Auto-suggest patterns that match a project's stack.",
    {
      project: z.string().optional().describe("Project slug"),
      stack: z.array(z.string()).optional().describe("Stack keywords to match against"),
    },
    { readOnlyHint: true },
    async ({ project, stack }) => {
      let stackTerms: string[] = stack ?? [];

      if (project && stackTerms.length === 0) {
        const proj = projectsRepo.getBySlug(project);
        if (!proj) return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
        stackTerms = Object.values(proj.architecture.stack).map((v) => v.toLowerCase());
        for (const comp of proj.architecture.components) {
          if (comp.type) stackTerms.push(comp.type.toLowerCase());
        }
      }

      if (stackTerms.length === 0) {
        return { content: [{ type: "text" as const, text: "Provide a project slug or stack keywords." }], isError: true };
      }

      const lowerTerms = stackTerms.map((t) => t.toLowerCase());
      const allPatterns = patternsRepo.list();
      if (allPatterns.length === 0) {
        return { content: [{ type: "text" as const, text: "No patterns registered yet." }] };
      }

      const suggestions: PatternSuggestion[] = [];
      for (const pattern of allPatterns) {
        const patternTerms = [...pattern.tags.map((t) => t.toLowerCase()), ...(pattern.stack ?? []).map((s) => s.toLowerCase())];
        const overlap = lowerTerms.filter((t) => patternTerms.includes(t));
        if (overlap.length === 0) continue;
        const usageCount = pattern.used_in?.length ?? 0;
        suggestions.push({ slug: pattern.slug, name: pattern.name, description: pattern.description, tags: pattern.tags, stack_overlap: overlap, usage_count: usageCount, confidence: computeConfidence(usageCount, overlap.length) });
      }

      if (suggestions.length === 0) {
        return { content: [{ type: "text" as const, text: `No patterns match the stack [${lowerTerms.join(", ")}].` }] };
      }

      const order = { high: 3, medium: 2, low: 1 };
      suggestions.sort((a, b) => order[b.confidence] - order[a.confidence] || b.usage_count - a.usage_count || b.stack_overlap.length - a.stack_overlap.length);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ stack: lowerTerms, suggestions_count: suggestions.length, suggestions }, null, 2) }],
      };
    },
  );
}
