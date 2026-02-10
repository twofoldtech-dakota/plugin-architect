import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { Idea } from "../types/idea.js";

interface SimilarProject {
  project: string;
  description: string;
  status: string;
  stack: Record<string, string>;
  similarity_score: number;
  stack_overlap: string[];
  component_overlap: string[];
  match_reasons: string[];
}

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/.,;:!?()]+/)
    .filter((t) => t.length > 2);
}

function computeOverlap(aTerms: string[], bTerms: string[]): string[] {
  return [...new Set(aTerms.filter((t) => bTerms.includes(t)))];
}

export function registerScoreSimilarity(server: McpServer): void {
  server.tool(
    "hive_score_similarity",
    "Compare a description or idea against existing projects to find similar ones. Useful for checking if something similar already exists or finding reference projects.",
    {
      description: z.string().describe("Description of what you want to build"),
      stack: z.array(z.string()).optional().describe("Stack keywords to match (e.g., ['typescript', 'react', 'postgres'])"),
      idea: z.string().optional().describe("Idea slug to compare against existing projects"),
    },
    async ({ description, stack, idea }) => {
      let queryTerms = extractTerms(description);
      let stackTerms = (stack ?? []).map((s) => s.toLowerCase());

      // If an idea slug is provided, enrich query terms from the idea
      if (idea) {
        try {
          const ideaData = await readYaml<Idea>(join(HIVE_DIRS.ideas, `${idea}.yaml`));
          const ideaText = `${ideaData.name} ${ideaData.problem} ${ideaData.audience} ${ideaData.proposed_solution}`;
          queryTerms = [...queryTerms, ...extractTerms(ideaText)];
        } catch {
          // idea not found, continue with description only
        }
      }

      const uniqueTerms = [...new Set(queryTerms)];

      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      const results: SimilarProject[] = [];

      for (const dir of projectDirs) {
        let arch: Architecture;
        try {
          arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
        } catch {
          continue;
        }

        const reasons: string[] = [];

        // Score description similarity
        const archText = `${arch.project} ${arch.description}`;
        const archTerms = extractTerms(archText);
        const descOverlap = computeOverlap(uniqueTerms, archTerms);
        let score = descOverlap.length * 2;
        if (descOverlap.length > 0) {
          reasons.push(`Description matches: ${descOverlap.join(", ")}`);
        }

        // Score stack similarity
        const archStackValues = Object.values(arch.stack).map((v) => v.toLowerCase());
        const stackOverlap = stackTerms.length > 0
          ? computeOverlap(stackTerms, archStackValues)
          : [];
        score += stackOverlap.length * 3;
        if (stackOverlap.length > 0) {
          reasons.push(`Stack overlap: ${stackOverlap.join(", ")}`);
        }

        // Score component similarity
        const componentNames = arch.components.map((c) => c.name.toLowerCase());
        const componentTypes = arch.components.map((c) => c.type.toLowerCase());
        const allComponentTerms = [...componentNames, ...componentTypes];
        const componentOverlap = computeOverlap(uniqueTerms, allComponentTerms);
        score += componentOverlap.length * 2;
        if (componentOverlap.length > 0) {
          reasons.push(`Component matches: ${componentOverlap.join(", ")}`);
        }

        // Also check component descriptions
        for (const comp of arch.components) {
          const compDescTerms = extractTerms(comp.description);
          const compOverlap = computeOverlap(uniqueTerms, compDescTerms);
          score += compOverlap.length;
        }

        if (score > 0) {
          results.push({
            project: dir,
            description: arch.description,
            status: arch.status,
            stack: arch.stack,
            similarity_score: score,
            stack_overlap: stackOverlap,
            component_overlap: componentOverlap,
            match_reasons: reasons,
          });
        }
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No similar projects found for "${description.slice(0, 80)}".`,
            },
          ],
        };
      }

      results.sort((a, b) => b.similarity_score - a.similarity_score);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query: description.slice(0, 120),
                stack_filter: stackTerms.length > 0 ? stackTerms : undefined,
                total_similar: results.length,
                projects: results,
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
