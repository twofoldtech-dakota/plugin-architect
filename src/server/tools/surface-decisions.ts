import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Decision, DecisionLog } from "../types/architecture.js";

interface SurfacedDecision {
  project: string;
  decision: Decision;
  relevance: "exact" | "related";
  match_reason: string;
}

function normalizeComponent(name: string): string[] {
  // Split on common delimiters and lowercase for flexible matching
  return name
    .toLowerCase()
    .split(/[\s_\-/]+/)
    .filter((t) => t.length > 0);
}

export function registerSurfaceDecisions(server: McpServer): void {
  server.tool(
    "hive_surface_decisions",
    "Surface relevant decisions from past projects for a given component. Useful when making a new decision — shows what was decided before and why.",
    {
      component: z.string().describe("Component name or type (e.g., 'auth', 'database', 'api-layer')"),
      project: z.string().optional().describe("Exclude this project from results (typically the current project)"),
      include_current: z.boolean().optional().describe("Include decisions from the current project too (default false)"),
    },
    async ({ component, project, include_current }) => {
      const componentTerms = normalizeComponent(component);

      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      const results: SurfacedDecision[] = [];

      for (const dir of projectDirs) {
        // Skip current project unless explicitly included
        if (dir === project && !include_current) continue;

        let log: DecisionLog;
        try {
          log = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, dir, "decisions.yaml"));
        } catch {
          continue;
        }

        for (const decision of log.decisions) {
          const decisionComponentTerms = normalizeComponent(decision.component);

          // Exact match: component names overlap directly
          const exactOverlap = componentTerms.some((t) => decisionComponentTerms.includes(t));

          if (exactOverlap) {
            results.push({
              project: dir,
              decision,
              relevance: "exact",
              match_reason: `Component "${decision.component}" matches "${component}"`,
            });
            continue;
          }

          // Related match: decision text or reasoning mentions the component
          const decisionText = `${decision.decision} ${decision.reasoning}`.toLowerCase();
          const relatedMatch = componentTerms.some((t) => decisionText.includes(t));

          if (relatedMatch) {
            results.push({
              project: dir,
              decision,
              relevance: "related",
              match_reason: `Decision mentions "${component}" in its text or reasoning`,
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No past decisions found for component "${component}". This will be the first decision on this topic.`,
            },
          ],
        };
      }

      // Sort: exact matches first, then related
      results.sort((a, b) => {
        if (a.relevance === "exact" && b.relevance !== "exact") return -1;
        if (a.relevance !== "exact" && b.relevance === "exact") return 1;
        return 0;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                component,
                total_results: results.length,
                exact_matches: results.filter((r) => r.relevance === "exact").length,
                related_matches: results.filter((r) => r.relevance === "related").length,
                decisions: results,
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
