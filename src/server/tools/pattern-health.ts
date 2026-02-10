import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";
import type { PatternHealthEntry, PatternHealthReport } from "../types/retrospective.js";

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function computeStaleness(pattern: Pattern): "fresh" | "aging" | "stale" {
  // Use lineage last entry date, or created date as fallback
  let lastActivity = pattern.created;
  if (pattern.lineage && pattern.lineage.length > 0) {
    lastActivity = pattern.lineage[pattern.lineage.length - 1].date;
  }

  const age = daysSince(lastActivity);
  if (age <= 30) return "fresh";
  if (age <= 90) return "aging";
  return "stale";
}

function computeConfidence(
  usageCount: number,
  modificationRate: number,
  verified: boolean,
): "high" | "medium" | "low" {
  if (usageCount >= 3 && modificationRate < 0.3 && verified) return "high";
  if (usageCount >= 1 && modificationRate < 0.5) return "medium";
  return "low";
}

function generateRecommendations(
  pattern: Pattern,
  staleness: "fresh" | "aging" | "stale",
  modificationRate: number,
  usageCount: number,
): string[] {
  const recs: string[] = [];

  if (staleness === "stale" && usageCount === 0) {
    recs.push("Consider archiving — pattern is stale with no recent usage.");
  } else if (staleness === "stale") {
    recs.push("Pattern is aging — review for relevance and update if needed.");
  }

  if (modificationRate > 0.5) {
    recs.push(
      "High modification rate — consider splitting into variants or updating the base pattern.",
    );
  }

  if (usageCount >= 5 && modificationRate < 0.2) {
    recs.push("Battle-tested pattern — high confidence, consider promoting as a standard.");
  }

  if (!pattern.notes) {
    recs.push("Missing usage notes — add documentation for gotchas and best practices.");
  }

  if (!pattern.stack || pattern.stack.length === 0) {
    recs.push("No stack tags — add stack context to improve discoverability.");
  }

  return recs;
}

export function registerPatternHealth(server: McpServer): void {
  server.tool(
    "hive_pattern_health",
    "Analyze pattern quality metrics: usage count, modification rate, staleness, and confidence. Generates recommendations for improving the pattern library.",
    {
      pattern: z
        .string()
        .optional()
        .describe("Specific pattern slug to analyze. Omit to analyze all patterns."),
    },
    async ({ pattern: patternSlug }) => {
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

      // Filter to specific pattern if requested
      let entries = index.patterns;
      if (patternSlug) {
        entries = entries.filter((e) => e.slug === patternSlug);
        if (entries.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Pattern "${patternSlug}" not found.` }],
            isError: true,
          };
        }
      }

      const healthEntries: PatternHealthEntry[] = [];
      const confidenceScores: number[] = [];

      for (const entry of entries) {
        let pattern: Pattern;
        try {
          pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
        } catch {
          continue;
        }

        const usageCount = pattern.used_in?.length ?? 0;

        // Count recent uses (within 30 days) from lineage
        let recentUses = 0;
        if (pattern.lineage) {
          recentUses = pattern.lineage.filter((l) => daysSince(l.date) <= 30).length;
        }

        // Modification rate: lineage entries with "changes" vs total uses
        const lineageCount = pattern.lineage?.length ?? 0;
        const modificationRate = usageCount > 0 ? lineageCount / usageCount : 0;

        const staleness = computeStaleness(pattern);
        const confidence = computeConfidence(usageCount, modificationRate, pattern.verified);
        const recommendations = generateRecommendations(pattern, staleness, modificationRate, usageCount);

        // Determine last used date
        let lastUsed: string | undefined;
        if (pattern.lineage && pattern.lineage.length > 0) {
          lastUsed = pattern.lineage[pattern.lineage.length - 1].date;
        } else if (usageCount > 0) {
          lastUsed = pattern.created;
        }

        const confScore = confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
        confidenceScores.push(confScore);

        healthEntries.push({
          slug: entry.slug,
          name: entry.name,
          total_uses: usageCount,
          recent_uses: recentUses,
          modification_rate: Math.round(modificationRate * 100) / 100,
          staleness,
          confidence,
          last_used: lastUsed,
          recommendations,
        });
      }

      // Sort: stale first, then by confidence ascending (worst first)
      const stalenessOrder = { stale: 0, aging: 1, fresh: 2 };
      healthEntries.sort(
        (a, b) => stalenessOrder[a.staleness] - stalenessOrder[b.staleness] || a.total_uses - b.total_uses,
      );

      const freshCount = healthEntries.filter((h) => h.staleness === "fresh").length;
      const agingCount = healthEntries.filter((h) => h.staleness === "aging").length;
      const staleCount = healthEntries.filter((h) => h.staleness === "stale").length;
      const avgConfidence =
        confidenceScores.length > 0
          ? Math.round((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 100) / 100
          : 0;

      const report: PatternHealthReport = {
        patterns: healthEntries,
        summary: {
          total: healthEntries.length,
          fresh: freshCount,
          aging: agingCount,
          stale: staleCount,
          avg_confidence: avgConfidence,
        },
        updated: new Date().toISOString().split("T")[0],
      };

      // Save metrics
      await writeYaml(join(HIVE_DIRS.metrics, "pattern-health.yaml"), report);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    },
  );
}
