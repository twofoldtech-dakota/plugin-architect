import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

interface ScoredPattern {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  usage_count: number;
  verified: boolean;
  confidence: "high" | "medium" | "low";
  score: number;
  used_in: string[];
}

function computeScore(pattern: Pattern): { score: number; confidence: "high" | "medium" | "low" } {
  const usageCount = pattern.used_in?.length ?? 0;
  const isVerified = pattern.verified ? 1 : 0;
  const hasStack = (pattern.stack?.length ?? 0) > 0 ? 1 : 0;
  const hasNotes = pattern.notes ? 1 : 0;

  // Weighted score: usage is primary signal, verification and metadata are secondary
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
    "Score and rank all registered patterns by confidence. Patterns used across more projects rank higher. Useful for identifying your most reliable, battle-tested patterns.",
    {
      stack: z.array(z.string()).optional().describe("Filter by stack (e.g., ['typescript', 'react'])"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      min_confidence: z.enum(["high", "medium", "low"]).optional().describe("Minimum confidence level to include (default: all)"),
    },
    async ({ stack, tags, min_confidence }) => {
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

      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      const minLevel = min_confidence ? confidenceOrder[min_confidence] : 0;

      const scored: ScoredPattern[] = [];

      for (const entry of index.patterns) {
        // Pre-filter by tags if provided
        if (tags && tags.length > 0) {
          const lowerTags = tags.map((t) => t.toLowerCase());
          const hasTag = entry.tags.some((t) => lowerTags.includes(t.toLowerCase()));
          if (!hasTag) continue;
        }

        let pattern: Pattern;
        try {
          pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
        } catch {
          continue;
        }

        // Filter by stack if provided
        if (stack && stack.length > 0 && pattern.stack) {
          const lowerStack = stack.map((s) => s.toLowerCase());
          const hasStack = pattern.stack.some((s) => lowerStack.includes(s.toLowerCase()));
          if (!hasStack) continue;
        }

        const { score, confidence } = computeScore(pattern);

        // Filter by minimum confidence
        if (confidenceOrder[confidence] < minLevel) continue;

        scored.push({
          slug: entry.slug,
          name: entry.name,
          description: pattern.description,
          tags: entry.tags,
          usage_count: pattern.used_in?.length ?? 0,
          verified: pattern.verified,
          confidence,
          score,
          used_in: pattern.used_in ?? [],
        });
      }

      if (scored.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No patterns match the specified filters.",
            },
          ],
        };
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      const highCount = scored.filter((p) => p.confidence === "high").length;
      const mediumCount = scored.filter((p) => p.confidence === "medium").length;
      const lowCount = scored.filter((p) => p.confidence === "low").length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total: scored.length,
                by_confidence: { high: highCount, medium: mediumCount, low: lowCount },
                patterns: scored,
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
