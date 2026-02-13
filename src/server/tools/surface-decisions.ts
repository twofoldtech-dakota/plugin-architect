import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { decisionsRepo, projectsRepo } from "../storage/index.js";
import type { Decision } from "../types/architecture.js";

function normalizeComponent(name: string): string[] {
  return name.toLowerCase().split(/[\s_\-/]+/).filter((t) => t.length > 0);
}

export function registerSurfaceDecisions(server: McpServer): void {
  server.tool(
    "hive_surface_decisions",
    "Surface relevant decisions from past projects for a given component.",
    {
      component: z.string().describe("Component name or type"),
      project: z.string().optional().describe("Exclude this project from results"),
      include_current: z.boolean().optional().describe("Include decisions from the current project too"),
    },
    { readOnlyHint: true },
    async ({ component, project, include_current }) => {
      const componentTerms = normalizeComponent(component);
      const allDecisions = decisionsRepo.listAll();
      const projects = projectsRepo.list();
      const projectMap = new Map(projects.map((p) => [p.id, p.slug]));

      // Optionally find current project id to exclude
      const currentProj = project ? projects.find((p) => p.slug === project) : undefined;

      const results: Array<{ project: string; decision: Decision & { project_id: string }; relevance: "exact" | "related"; match_reason: string }> = [];

      for (const decision of allDecisions) {
        const projSlug = projectMap.get(decision.project_id) ?? "unknown";
        if (projSlug === project && !include_current) continue;

        const decisionComponentTerms = normalizeComponent(decision.component);
        const exactOverlap = componentTerms.some((t) => decisionComponentTerms.includes(t));
        if (exactOverlap) {
          results.push({ project: projSlug, decision, relevance: "exact", match_reason: `Component "${decision.component}" matches "${component}"` });
          continue;
        }

        const decisionText = `${decision.decision} ${decision.reasoning}`.toLowerCase();
        if (componentTerms.some((t) => decisionText.includes(t))) {
          results.push({ project: projSlug, decision, relevance: "related", match_reason: `Decision mentions "${component}"` });
        }
      }

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No past decisions found for component "${component}".` }] };
      }

      results.sort((a, b) => (a.relevance === "exact" ? -1 : 1) - (b.relevance === "exact" ? -1 : 1));

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            component,
            total_results: results.length,
            exact_matches: results.filter((r) => r.relevance === "exact").length,
            related_matches: results.filter((r) => r.relevance === "related").length,
            decisions: results,
          }, null, 2),
        }],
      };
    },
  );
}
