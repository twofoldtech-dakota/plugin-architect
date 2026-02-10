import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Idea } from "../types/idea.js";
import type { PatternIndex } from "../types/pattern.js";
import type { Architecture } from "../types/architecture.js";
import type { IdeaPipelineEntry } from "../types/sovereign.js";

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/,;:.]+/)
    .filter((t) => t.length > 2);
}

export function registerIdeaPipeline(server: McpServer): void {
  server.tool(
    "hive_idea_pipeline",
    "Score and rank all ideas by capability, pattern coverage, and estimated effort. Returns a prioritized pipeline of what to build next.",
    {
      filter: z
        .enum(["raw", "evaluated", "all"])
        .optional()
        .default("raw")
        .describe('Filter ideas by status (default: "raw")'),
    },
    async ({ filter }) => {
      // Read all ideas
      let ideaFiles: string[];
      try {
        ideaFiles = await readdir(HIVE_DIRS.ideas);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No ideas found." }],
        };
      }

      const yamlFiles = ideaFiles.filter((f) => f.endsWith(".yaml"));
      if (yamlFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No ideas found." }],
        };
      }

      // Load patterns index for coverage scoring
      let patternIndex: PatternIndex | null = null;
      try {
        patternIndex = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
      } catch {
        // No patterns
      }

      // Load all project architectures for similarity comparison
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        projectDirs = [];
      }

      const projectArchitectures: Array<{ dir: string; arch: Architecture }> = [];
      for (const dir of projectDirs) {
        try {
          const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
          projectArchitectures.push({ dir, arch });
        } catch {
          continue;
        }
      }

      const pipeline: IdeaPipelineEntry[] = [];

      for (const file of yamlFiles) {
        let idea: Idea;
        try {
          idea = await readYaml<Idea>(join(HIVE_DIRS.ideas, file));
        } catch {
          continue;
        }

        // Apply filter
        if (filter === "raw" && idea.status !== "raw") continue;
        if (filter === "evaluated" && idea.status !== "evaluated") continue;

        const ideaTerms = normalizeTerms(
          `${idea.name} ${idea.problem} ${idea.proposed_solution} ${idea.audience}`,
        );

        // Score pattern coverage
        let patternCoverage = 0;
        if (patternIndex && patternIndex.patterns.length > 0) {
          const matchingPatterns = patternIndex.patterns.filter((p) => {
            const tagMatch = p.tags.some((t) => ideaTerms.includes(t.toLowerCase()));
            const nameMatch = normalizeTerms(p.name).some((t) => ideaTerms.includes(t));
            return tagMatch || nameMatch;
          });
          const estimatedNeeds = idea.evaluation?.scope?.mvp_components?.length ?? 5;
          patternCoverage =
            estimatedNeeds > 0
              ? Math.min(1, Math.round((matchingPatterns.length / estimatedNeeds) * 100) / 100)
              : 0;
        }

        // Estimate sessions from similar projects or evaluation
        let estimatedSessions = idea.evaluation?.feasibility?.estimated_sessions ?? 0;
        if (estimatedSessions === 0) {
          // Heuristic from similar projects
          let bestMatch = 0;
          for (const { arch } of projectArchitectures) {
            const archTerms = normalizeTerms(
              `${arch.description} ${arch.components.map((c) => `${c.name} ${c.type}`).join(" ")}`,
            );
            const overlap = ideaTerms.filter((t) => archTerms.includes(t)).length / Math.max(ideaTerms.length, 1);
            if (overlap > bestMatch) {
              bestMatch = overlap;
              estimatedSessions = Math.max(1, arch.components.length);
            }
          }
          if (estimatedSessions === 0) estimatedSessions = 5; // Default
        }

        // Capability score: how much of this can we build with existing knowledge
        const capabilityScore = Math.round(
          (patternCoverage * 0.5 + (projectArchitectures.length > 0 ? 0.3 : 0) + (idea.evaluation ? 0.2 : 0)) * 100,
        ) / 100;

        // Feasibility weight from evaluation
        const feasibilityScore = idea.evaluation?.feasibility?.score ?? 3;

        // Priority score (weighted combination)
        const priorityScore = Math.round(
          (capabilityScore * 30 + feasibilityScore * 20 + (1 - estimatedSessions / 20) * 25 + patternCoverage * 25) * 100,
        ) / 10000;

        // Recommendation
        let recommendation: IdeaPipelineEntry["recommendation"];
        if (!idea.evaluation) {
          recommendation = "needs_evaluation";
        } else if (idea.evaluation.verdict === "park") {
          recommendation = "park";
        } else if (priorityScore > 0.6) {
          recommendation = "build_next";
        } else if (priorityScore > 0.3) {
          recommendation = "build_soon";
        } else {
          recommendation = "park";
        }

        pipeline.push({
          slug: idea.slug,
          name: idea.name,
          status: idea.status,
          capability_score: capabilityScore,
          pattern_coverage: patternCoverage,
          estimated_sessions: estimatedSessions,
          priority_score: Math.round(priorityScore * 100) / 100,
          recommendation,
        });
      }

      // Sort by priority score descending
      pipeline.sort((a, b) => b.priority_score - a.priority_score);

      const summary = {
        total: pipeline.length,
        build_next: pipeline.filter((p) => p.recommendation === "build_next").length,
        build_soon: pipeline.filter((p) => p.recommendation === "build_soon").length,
        park: pipeline.filter((p) => p.recommendation === "park").length,
        needs_evaluation: pipeline.filter((p) => p.recommendation === "needs_evaluation").length,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ pipeline, summary }, null, 2),
          },
        ],
      };
    },
  );
}
