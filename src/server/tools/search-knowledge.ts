import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { patternsRepo, dependenciesRepo, decisionsRepo, projectsRepo, workflowRepo } from "../storage/index.js";

interface SearchResult {
  type: "pattern" | "dependency" | "decision" | "architecture" | "workflow";
  name: string;
  relevance: number;
  summary: string;
  data: unknown;
}

function scoreMatch(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) {
      score += 1;
      if (lower.split(/\s+/).includes(term)) score += 0.5;
    }
  }
  return score;
}

export function registerSearchKnowledge(server: McpServer): void {
  registerAppTool(
    server,
    "hive_search_knowledge",
    {
      description: "Search across all Hive knowledge — patterns, dependencies, decisions, architectures, and workflow entries.",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: "ui://hive/search-results" } },
      inputSchema: {
        query: z.string().describe("Search query"),
      },
    },
    async ({ query }) => {
      const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
      if (terms.length === 0) {
        return { content: [{ type: "text" as const, text: "Please provide a search query." }], isError: true };
      }

      const results: SearchResult[] = [];

      // Search patterns
      for (const p of patternsRepo.list()) {
        const score = scoreMatch(`${p.name} ${p.description} ${p.tags.join(" ")}`, terms);
        if (score > 0) results.push({ type: "pattern", name: p.name, relevance: score, summary: p.description, data: p });
      }

      // Search dependencies
      for (const d of dependenciesRepo.list()) {
        let score = scoreMatch(d.name, terms);
        if (d.exports) {
          for (const exp of d.exports) score += scoreMatch(`${exp.name} ${exp.description}`, terms) * 0.5;
        }
        if (score > 0) results.push({ type: "dependency", name: d.name, relevance: score, summary: `${d.name}@${d.version}`, data: d });
      }

      // Search decisions
      for (const d of decisionsRepo.listAll()) {
        const score = scoreMatch(`${d.component} ${d.decision} ${d.reasoning}`, terms);
        if (score > 0) results.push({ type: "decision", name: `${d.id}: ${d.decision.slice(0, 60)}`, relevance: score, summary: `${d.component}: ${d.decision}`, data: d });
      }

      // Search projects/architectures
      for (const p of projectsRepo.list()) {
        const arch = p.architecture;
        const stackText = Object.entries(arch.stack).map(([k, v]) => `${k} ${v}`).join(" ");
        const compText = arch.components.map((c) => `${c.name} ${c.description}`).join(" ");
        const score = scoreMatch(`${arch.project} ${arch.description} ${stackText} ${compText}`, terms);
        if (score > 0) results.push({ type: "architecture", name: arch.project, relevance: score, summary: `${arch.project} (${arch.status}) — ${arch.description}`, data: arch });
      }

      // Search workflow entries
      for (const w of workflowRepo.list()) {
        const score = scoreMatch(`${w.title} ${w.content} ${w.tags.join(" ")}`, terms);
        if (score > 0) results.push({ type: "workflow", name: w.title, relevance: score, summary: `${w.type}: ${w.title}`, data: w });
      }

      results.sort((a, b) => b.relevance - a.relevance);

      if (results.length === 0) {
        return { content: [{ type: "text" as const, text: `No results found for "${query}".` }] };
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ query, total_results: results.length, results }, null, 2) }],
      };
    },
  );
}
