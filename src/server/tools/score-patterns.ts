import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { patternsRepo } from "../storage/index.js";
import type { Pattern } from "../types/pattern.js";

function computeScore(pattern: Pattern): { score: number; confidence: "high" | "medium" | "low" } {
  const usageCount = pattern.used_in?.length ?? 0;
  const isVerified = pattern.verified ? 1 : 0;
  const hasStack = (pattern.stack?.length ?? 0) > 0 ? 1 : 0;
  const hasNotes = pattern.notes ? 1 : 0;
  const score = usageCount * 3 + isVerified * 2 + hasStack + hasNotes;
  let confidence: "high" | "medium" | "low";
  if (usageCount >= 3 && pattern.verified) confidence = "high";
  else if (usageCount >= 1 || pattern.verified) confidence = "medium";
  else confidence = "low";
  return { score, confidence };
}

export function registerScorePatterns(server: McpServer): void {
  server.tool(
    "hive_score_patterns",
    "Score and rank all registered patterns by confidence.",
    {
      stack: z.array(z.string()).optional().describe("Filter by stack"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      min_confidence: z.enum(["high", "medium", "low"]).optional().describe("Minimum confidence"),
    },
    async ({ stack, tags, min_confidence }) => {
      const allPatterns = patternsRepo.list();
      if (allPatterns.length === 0) return { content: [{ type: "text" as const, text: "No patterns registered yet." }] };

      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const minLevel = min_confidence ? confidenceOrder[min_confidence] : 0;

      const scored: Array<{ slug: string; name: string; description: string; tags: string[]; usage_count: number; verified: boolean; confidence: "high" | "medium" | "low"; score: number; used_in: string[] }> = [];

      for (const pattern of allPatterns) {
        if (tags && tags.length > 0) {
          const lowerTags = tags.map((t) => t.toLowerCase());
          if (!pattern.tags.some((t) => lowerTags.includes(t.toLowerCase()))) continue;
        }
        if (stack && stack.length > 0 && pattern.stack) {
          const lowerStack = stack.map((s) => s.toLowerCase());
          if (!pattern.stack.some((s) => lowerStack.includes(s.toLowerCase()))) continue;
        }
        const { score, confidence } = computeScore(pattern);
        if (confidenceOrder[confidence] < minLevel) continue;
        scored.push({ slug: pattern.slug, name: pattern.name, description: pattern.description, tags: pattern.tags, usage_count: pattern.used_in?.length ?? 0, verified: pattern.verified, confidence, score, used_in: pattern.used_in ?? [] });
      }

      if (scored.length === 0) return { content: [{ type: "text" as const, text: "No patterns match the specified filters." }] };
      scored.sort((a, b) => b.score - a.score);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ total: scored.length, by_confidence: { high: scored.filter((p) => p.confidence === "high").length, medium: scored.filter((p) => p.confidence === "medium").length, low: scored.filter((p) => p.confidence === "low").length }, patterns: scored }, null, 2),
        }],
      };
    },
  );
}
