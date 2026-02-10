import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { PatternIndex } from "../types/pattern.js";
import type { EstimateRecord, EstimatesHistory } from "../types/retrospective.js";
import type { Retrospective } from "../types/retrospective.js";

interface SimilarProject {
  project: string;
  similarity: number;
  components: number;
  stack_overlap: number;
  actual_sessions?: number;
}

interface EstimateResult {
  estimated_sessions: number;
  confidence: "high" | "medium" | "low";
  similar_projects: SimilarProject[];
  contributing_factors: {
    pattern_coverage: number;
    stack_familiarity: number;
    scope_complexity: "low" | "medium" | "high";
    historical_accuracy: number;
  };
  reasoning: string;
}

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/,;:.]+/)
    .filter((t) => t.length > 2);
}

function termsOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const matches = a.filter((t) => b.includes(t)).length;
  return matches / Math.max(a.length, b.length);
}

export function registerEstimate(server: McpServer): void {
  server.tool(
    "hive_estimate",
    "Estimate build effort for a project based on historical data, similar projects, pattern coverage, and stack familiarity.",
    {
      description: z.string().describe("Description of what you want to build"),
      components: z.number().optional().describe("Expected number of components"),
      stack: z.string().optional().describe("Stack preset slug or stack description"),
    },
    async ({ description, components, stack }) => {
      const descTerms = normalizeTerms(description);
      const stackTerms = stack ? normalizeTerms(stack) : [];

      // --- Load all project architectures for comparison ---
      const similarProjects: SimilarProject[] = [];
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        projectDirs = [];
      }

      for (const dir of projectDirs) {
        let arch: Architecture;
        try {
          arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
        } catch {
          continue;
        }

        // Compute description similarity
        const archTerms = normalizeTerms(
          `${arch.description} ${arch.components.map((c) => `${c.name} ${c.type} ${c.description}`).join(" ")}`,
        );
        const descSimilarity = termsOverlap(descTerms, archTerms);

        // Compute stack overlap
        const archStackTerms = Object.values(arch.stack).map((v) => String(v).toLowerCase());
        const stackOverlap =
          stackTerms.length > 0
            ? stackTerms.filter((t) => archStackTerms.some((s) => s.includes(t))).length / stackTerms.length
            : 0;

        const similarity = Math.round((descSimilarity * 0.6 + stackOverlap * 0.4) * 100) / 100;

        if (similarity > 0.05) {
          // Try to read retrospective for actual session data
          let actualSessions: number | undefined;
          try {
            const retro = await readYaml<Retrospective>(join(HIVE_DIRS.retrospectives, `${dir}.yaml`));
            // Estimate sessions from component count (rough proxy)
            actualSessions = retro.planning_accuracy.actual_components;
          } catch {
            // No retrospective
          }

          similarProjects.push({
            project: dir,
            similarity,
            components: arch.components.length,
            stack_overlap: Math.round(stackOverlap * 100) / 100,
            actual_sessions: actualSessions,
          });
        }
      }

      // Sort by similarity
      similarProjects.sort((a, b) => b.similarity - a.similarity);
      const topSimilar = similarProjects.slice(0, 5);

      // --- Pattern coverage ---
      let patternCoverage = 0;
      try {
        const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
        const matchingPatterns = index.patterns.filter((p) => {
          const tagMatch = p.tags.some((t) => descTerms.includes(t.toLowerCase()));
          const nameMatch = normalizeTerms(p.name).some((t) => descTerms.includes(t));
          return tagMatch || nameMatch;
        });
        const estimatedNeeds = components ?? (topSimilar.length > 0 ? topSimilar[0].components : 5);
        patternCoverage = estimatedNeeds > 0
          ? Math.min(1, Math.round((matchingPatterns.length / estimatedNeeds) * 100) / 100)
          : 0;
      } catch {
        // No patterns
      }

      // --- Stack familiarity ---
      let stackFamiliarity = 0;
      if (stackTerms.length > 0 && projectDirs.length > 0) {
        let projectsWithStack = 0;
        for (const dir of projectDirs) {
          try {
            const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
            const archStackTerms = Object.values(arch.stack).map((v) => String(v).toLowerCase());
            if (stackTerms.some((t) => archStackTerms.some((s) => s.includes(t)))) {
              projectsWithStack++;
            }
          } catch {
            continue;
          }
        }
        stackFamiliarity = Math.min(1, Math.round((projectsWithStack / projectDirs.length) * 100) / 100);
      }

      // --- Scope complexity ---
      const componentCount = components ?? (topSimilar.length > 0 ? topSimilar[0].components : 5);
      let scopeComplexity: "low" | "medium" | "high";
      if (componentCount <= 3) scopeComplexity = "low";
      else if (componentCount <= 8) scopeComplexity = "medium";
      else scopeComplexity = "high";

      // --- Historical accuracy ---
      let historicalAccuracy = 0;
      try {
        const history = await readYaml<EstimatesHistory>(join(HIVE_DIRS.metrics, "estimates.yaml"));
        const withActuals = history.estimates.filter((e) => e.actual_sessions != null);
        if (withActuals.length > 0) {
          const accuracies = withActuals.map((e) => {
            const diff = Math.abs(e.estimated_sessions - (e.actual_sessions ?? e.estimated_sessions));
            return 1 - diff / Math.max(e.estimated_sessions, e.actual_sessions ?? 1);
          });
          historicalAccuracy = Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 100) / 100;
        }
      } catch {
        // No historical data
      }

      // --- Compute estimate ---
      let baseSessions: number;

      // Use similar projects if available
      const projectsWithSessions = topSimilar.filter((p) => p.actual_sessions != null);
      if (projectsWithSessions.length > 0) {
        // Weighted average by similarity
        const totalWeight = projectsWithSessions.reduce((sum, p) => sum + p.similarity, 0);
        baseSessions = projectsWithSessions.reduce(
          (sum, p) => sum + (p.actual_sessions ?? 0) * (p.similarity / totalWeight),
          0,
        );
      } else {
        // Heuristic based on component count
        const complexityMultiplier = scopeComplexity === "high" ? 2 : scopeComplexity === "medium" ? 1.5 : 1;
        baseSessions = componentCount * complexityMultiplier;
      }

      // Adjust for pattern coverage (reduces effort)
      const patternDiscount = 1 - patternCoverage * 0.3;

      // Adjust for stack familiarity (reduces effort)
      const familiarityDiscount = 1 - stackFamiliarity * 0.2;

      const estimatedSessions = Math.max(1, Math.round(baseSessions * patternDiscount * familiarityDiscount));

      // --- Confidence ---
      let confidence: "high" | "medium" | "low";
      if (topSimilar.length >= 3 && historicalAccuracy > 0.7) confidence = "high";
      else if (topSimilar.length >= 1 || historicalAccuracy > 0.5) confidence = "medium";
      else confidence = "low";

      // --- Reasoning ---
      const parts: string[] = [];
      parts.push(`Estimated ${estimatedSessions} session(s) for this ${scopeComplexity}-complexity project.`);
      if (topSimilar.length > 0) {
        parts.push(`Based on ${topSimilar.length} similar project(s).`);
      }
      if (patternCoverage > 0) {
        parts.push(`${Math.round(patternCoverage * 100)}% pattern coverage reduces effort.`);
      }
      if (stackFamiliarity > 0) {
        parts.push(`${Math.round(stackFamiliarity * 100)}% stack familiarity reduces ramp-up.`);
      }
      if (confidence === "low") {
        parts.push("Low confidence — limited historical data available.");
      }

      const result: EstimateResult = {
        estimated_sessions: estimatedSessions,
        confidence,
        similar_projects: topSimilar,
        contributing_factors: {
          pattern_coverage: Math.round(patternCoverage * 100) / 100,
          stack_familiarity: Math.round(stackFamiliarity * 100) / 100,
          scope_complexity: scopeComplexity,
          historical_accuracy: historicalAccuracy,
        },
        reasoning: parts.join(" "),
      };

      // Save estimate to history
      const estimatePath = join(HIVE_DIRS.metrics, "estimates.yaml");
      let history: EstimatesHistory;
      try {
        history = await readYaml<EstimatesHistory>(estimatePath);
      } catch {
        history = { estimates: [] };
      }

      history.estimates.push({
        project: "estimate-" + Date.now(),
        description,
        estimated_sessions: estimatedSessions,
        components: componentCount,
        stack,
        pattern_coverage: patternCoverage,
        date: new Date().toISOString().split("T")[0],
      });

      await writeYaml(estimatePath, history);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
