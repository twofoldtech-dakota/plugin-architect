import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";
import type { BuildPlan } from "../types/build-plan.js";
import type { Retrospective } from "../types/retrospective.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerRetrospective(server: McpServer): void {
  server.tool(
    "hive_retrospective",
    "Run a retrospective on a project build. Analyzes planning accuracy, pattern reuse, knowledge usage, and generates lessons learned with scores.",
    {
      project: z.string().describe("Project slug"),
    },
    async ({ project }) => {
      const projDir = join(HIVE_DIRS.projects, project);

      // Read architecture (required)
      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(projDir, "architecture.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      // Read decisions
      const decisionLog = await safeRead<DecisionLog>(join(projDir, "decisions.yaml"));
      const decisions = decisionLog?.decisions ?? [];

      // Read build plan if exists
      const buildPlan = await safeRead<BuildPlan>(join(projDir, "build-plan.yaml"));

      // --- Planning Accuracy ---
      const plannedComponents = architecture.components.length;

      // Count actual built components from build plan tasks or just use component count
      let actualComponents = plannedComponents;
      if (buildPlan) {
        const completedTasks = buildPlan.phases.flatMap((p) => p.tasks).filter((t) => t.status === "completed");
        const uniqueComponents = new Set(completedTasks.map((t) => t.component).filter(Boolean));
        if (uniqueComponents.size > 0) {
          actualComponents = uniqueComponents.size;
        }
      }

      const scopeChangePct =
        plannedComponents > 0 ? Math.round(((actualComponents - plannedComponents) / plannedComponents) * 100) : 0;

      // --- Pattern Reuse ---
      const patternsUsed: Retrospective["pattern_reuse"]["patterns_used"] = [];
      try {
        const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
        for (const entry of index.patterns) {
          try {
            const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
            if (pattern.used_in?.includes(project)) {
              patternsUsed.push({
                name: pattern.name,
                slug: entry.slug,
                worked: true,
              });
            }
          } catch {
            continue;
          }
        }
      } catch {
        // No patterns index
      }

      const totalPatterns = patternsUsed.length;
      const reuseRate = plannedComponents > 0 ? Math.round((totalPatterns / plannedComponents) * 100) : 0;

      // --- Knowledge Usage ---
      let preRegisteredDepsUsed = 0;
      let newDepsAdded = 0;
      try {
        const depDirs = await readdir(HIVE_DIRS.dependencies);
        // Count deps that are in the project's stack
        const stackValues = Object.values(architecture.stack).map((v) => String(v).toLowerCase());
        for (const depName of depDirs) {
          if (stackValues.some((s) => s.includes(depName.toLowerCase()))) {
            preRegisteredDepsUsed++;
          }
        }
        // Count total deps in stack that may not have been registered
        newDepsAdded = Math.max(0, stackValues.length - preRegisteredDepsUsed);
      } catch {
        // No dependencies
      }

      // Decisions informed by history — look for decisions that reference past projects or "similar"
      const historyTerms = ["similar", "previous", "last time", "before", "pattern", "reused", "like we did"];
      const decisionsInformedByHistory = decisions.filter((d) =>
        historyTerms.some((term) => d.reasoning.toLowerCase().includes(term)),
      ).length;

      // Hallucinations caught — look for decisions about corrections or wrong assumptions
      const hallucinationTerms = ["wrong", "incorrect", "hallucin", "mistake", "corrected", "actually", "fixed assumption"];
      const hallucinationsCaught = decisions.filter((d) =>
        hallucinationTerms.some((term) =>
          d.reasoning.toLowerCase().includes(term) || d.decision.toLowerCase().includes(term),
        ),
      ).length;

      // --- Lessons Learned ---
      const lessons: string[] = [];

      if (scopeChangePct > 20) {
        lessons.push(`Scope grew by ${scopeChangePct}% — consider tighter upfront scoping.`);
      } else if (scopeChangePct < -20) {
        lessons.push(`Scope shrank by ${Math.abs(scopeChangePct)}% — initial plan was overscoped.`);
      } else {
        lessons.push("Scope remained close to plan — good planning accuracy.");
      }

      if (reuseRate > 50) {
        lessons.push(`High pattern reuse (${reuseRate}%) — knowledge base is paying off.`);
      } else if (reuseRate === 0 && plannedComponents > 0) {
        lessons.push("No patterns were reused — consider extracting patterns from this project.");
      }

      if (newDepsAdded > preRegisteredDepsUsed && newDepsAdded > 0) {
        lessons.push(
          `${newDepsAdded} new dependency/dependencies not pre-registered — register them to prevent future hallucination.`,
        );
      }

      if (hallucinationsCaught > 0) {
        lessons.push(
          `${hallucinationsCaught} potential hallucination(s) caught via decisions — dependency registration is working.`,
        );
      }

      // Check for revisit_when triggers in decisions
      const revisitDecisions = decisions.filter((d) => d.revisit_when);
      if (revisitDecisions.length > 0) {
        lessons.push(`${revisitDecisions.length} decision(s) flagged for future revisiting.`);
      }

      // --- Scores ---
      // Speed: based on scope accuracy and build plan completion
      let speedScore = 3;
      if (Math.abs(scopeChangePct) <= 10) speedScore = 5;
      else if (Math.abs(scopeChangePct) <= 25) speedScore = 4;
      else if (Math.abs(scopeChangePct) <= 50) speedScore = 2;
      else speedScore = 1;

      // Quality: based on pattern reuse and decision logging
      let qualityScore = 3;
      const decisionDensity = plannedComponents > 0 ? decisions.length / plannedComponents : 0;
      if (reuseRate > 50 && decisionDensity >= 1) qualityScore = 5;
      else if (reuseRate > 25 || decisionDensity >= 0.5) qualityScore = 4;
      else if (reuseRate > 0 || decisions.length > 0) qualityScore = 3;
      else qualityScore = 2;

      // Knowledge growth: based on new patterns, deps registered, decisions logged
      let knowledgeScore = 3;
      const knowledgeSignals = totalPatterns + preRegisteredDepsUsed + decisions.length;
      if (knowledgeSignals >= 10) knowledgeScore = 5;
      else if (knowledgeSignals >= 5) knowledgeScore = 4;
      else if (knowledgeSignals >= 2) knowledgeScore = 3;
      else knowledgeScore = 2;

      const overallScore = Math.round((speedScore + qualityScore + knowledgeScore) / 3);

      const retrospective: Retrospective = {
        project,
        created: new Date().toISOString().split("T")[0],
        planning_accuracy: {
          planned_components: plannedComponents,
          actual_components: actualComponents,
          scope_change_pct: scopeChangePct,
        },
        pattern_reuse: {
          patterns_used: patternsUsed,
          reuse_rate: reuseRate,
        },
        knowledge_usage: {
          pre_registered_deps_used: preRegisteredDepsUsed,
          new_deps_added: newDepsAdded,
          decisions_informed_by_history: decisionsInformedByHistory,
          hallucinations_caught: hallucinationsCaught,
        },
        lessons,
        scores: {
          speed: speedScore,
          quality: qualityScore,
          knowledge_growth: knowledgeScore,
          overall: overallScore,
        },
      };

      // Save retrospective
      await writeYaml(join(HIVE_DIRS.retrospectives, `${project}.yaml`), retrospective);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(retrospective, null, 2),
          },
        ],
      };
    },
  );
}
