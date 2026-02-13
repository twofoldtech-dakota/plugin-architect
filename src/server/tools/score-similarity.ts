import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, ideasRepo } from "../storage/index.js";

function extractTerms(text: string): string[] {
  return text.toLowerCase().split(/[\s_\-/.,;:!?()]+/).filter((t) => t.length > 2);
}

function computeOverlap(a: string[], b: string[]): string[] {
  return [...new Set(a.filter((t) => b.includes(t)))];
}

export function registerScoreSimilarity(server: McpServer): void {
  server.tool(
    "hive_score_similarity",
    "Compare a description against existing projects to find similar ones.",
    {
      description: z.string().describe("Description of what you want to build"),
      stack: z.array(z.string()).optional().describe("Stack keywords"),
      idea: z.string().optional().describe("Idea slug to compare"),
    },
    { readOnlyHint: true },
    async ({ description, stack, idea }) => {
      let queryTerms = extractTerms(description);
      const stackTerms = (stack ?? []).map((s) => s.toLowerCase());

      if (idea) {
        const ideaData = ideasRepo.getBySlug(idea);
        if (ideaData) {
          queryTerms = [...queryTerms, ...extractTerms(`${ideaData.name} ${ideaData.problem} ${ideaData.audience} ${ideaData.proposed_solution}`)];
        }
      }
      const uniqueTerms = [...new Set(queryTerms)];

      const projects = projectsRepo.list();
      const results: Array<{ project: string; description: string; status: string; stack: Record<string, string>; similarity_score: number; stack_overlap: string[]; component_overlap: string[]; match_reasons: string[] }> = [];

      for (const proj of projects) {
        const arch = proj.architecture;
        const reasons: string[] = [];
        const archTerms = extractTerms(`${arch.project} ${arch.description}`);
        const descOverlap = computeOverlap(uniqueTerms, archTerms);
        let score = descOverlap.length * 2;
        if (descOverlap.length > 0) reasons.push(`Description matches: ${descOverlap.join(", ")}`);

        const archStackValues = Object.values(arch.stack).map((v) => v.toLowerCase());
        const stackOverlap = stackTerms.length > 0 ? computeOverlap(stackTerms, archStackValues) : [];
        score += stackOverlap.length * 3;
        if (stackOverlap.length > 0) reasons.push(`Stack overlap: ${stackOverlap.join(", ")}`);

        const allComponentTerms = [...arch.components.map((c) => c.name.toLowerCase()), ...arch.components.map((c) => c.type.toLowerCase())];
        const componentOverlap = computeOverlap(uniqueTerms, allComponentTerms);
        score += componentOverlap.length * 2;
        if (componentOverlap.length > 0) reasons.push(`Component matches: ${componentOverlap.join(", ")}`);

        for (const comp of arch.components) score += computeOverlap(uniqueTerms, extractTerms(comp.description)).length;

        if (score > 0) results.push({ project: proj.slug, description: arch.description, status: arch.status, stack: arch.stack, similarity_score: score, stack_overlap: stackOverlap, component_overlap: componentOverlap, match_reasons: reasons });
      }

      if (results.length === 0) return { content: [{ type: "text" as const, text: `No similar projects found.` }] };
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      return { content: [{ type: "text" as const, text: JSON.stringify({ query: description.slice(0, 120), total_similar: results.length, projects: results }, null, 2) }] };
    },
  );
}
