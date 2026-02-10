import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";
import type { DependencyMeta, DependencySurface } from "../types/dependency.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";

interface SearchResult {
  type: "pattern" | "dependency" | "decision" | "architecture";
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
      // Bonus for exact word match
      if (lower.split(/\s+/).includes(term)) score += 0.5;
    }
  }
  return score;
}

async function searchPatterns(terms: string[]): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const indexPath = join(HIVE_DIRS.patterns, "index.yaml");

  let index: PatternIndex;
  try {
    index = await readYaml<PatternIndex>(indexPath);
  } catch {
    return results;
  }

  for (const entry of index.patterns) {
    const tagText = entry.tags.join(" ");
    const score = scoreMatch(`${entry.name} ${tagText}`, terms);
    if (score > 0) {
      let pattern: Pattern | undefined;
      try {
        pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
      } catch {
        // skip
      }

      results.push({
        type: "pattern",
        name: entry.name,
        relevance: score,
        summary: pattern?.description ?? `Pattern: ${entry.name} [${entry.tags.join(", ")}]`,
        data: pattern ?? entry,
      });
    }
  }

  return results;
}

async function searchDependencies(terms: string[]): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  let dirs: string[];
  try {
    dirs = await readdir(HIVE_DIRS.dependencies);
  } catch {
    return results;
  }

  for (const dir of dirs) {
    const score = scoreMatch(dir, terms);
    if (score > 0) {
      let meta: DependencyMeta | undefined;
      let surface: DependencySurface | undefined;
      try {
        meta = await readYaml<DependencyMeta>(join(HIVE_DIRS.dependencies, dir, "meta.yaml"));
        surface = await readYaml<DependencySurface>(join(HIVE_DIRS.dependencies, dir, "surface.yaml"));
      } catch {
        // skip
      }

      // Also score against exports and gotchas
      let extraScore = 0;
      if (surface?.exports) {
        for (const exp of surface.exports) {
          extraScore += scoreMatch(`${exp.name} ${exp.description}`, terms) * 0.5;
        }
      }
      if (surface?.gotchas) {
        extraScore += scoreMatch(surface.gotchas.join(" "), terms) * 0.3;
      }

      results.push({
        type: "dependency",
        name: dir,
        relevance: score + extraScore,
        summary: meta
          ? `${meta.name}@${meta.version}${meta.source ? ` (${meta.source})` : ""}`
          : `Dependency: ${dir}`,
        data: { meta, surface },
      });
    }
  }

  return results;
}

async function searchDecisions(terms: string[]): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(HIVE_DIRS.projects);
  } catch {
    return results;
  }

  for (const projectDir of projectDirs) {
    let log: DecisionLog;
    try {
      log = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, projectDir, "decisions.yaml"));
    } catch {
      continue;
    }

    for (const decision of log.decisions) {
      const text = `${decision.component} ${decision.decision} ${decision.reasoning}`;
      const score = scoreMatch(text, terms);
      if (score > 0) {
        results.push({
          type: "decision",
          name: `${projectDir}/${decision.id}: ${decision.decision.slice(0, 60)}`,
          relevance: score,
          summary: `[${projectDir}] ${decision.component}: ${decision.decision}`,
          data: { project: projectDir, ...decision },
        });
      }
    }
  }

  return results;
}

async function searchArchitectures(terms: string[]): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  let projectDirs: string[];
  try {
    projectDirs = await readdir(HIVE_DIRS.projects);
  } catch {
    return results;
  }

  for (const projectDir of projectDirs) {
    let arch: Architecture;
    try {
      arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, projectDir, "architecture.yaml"));
    } catch {
      continue;
    }

    const stackText = Object.entries(arch.stack)
      .map(([k, v]) => `${k} ${v}`)
      .join(" ");
    const componentText = arch.components.map((c) => `${c.name} ${c.description}`).join(" ");
    const text = `${arch.project} ${arch.description} ${stackText} ${componentText}`;
    const score = scoreMatch(text, terms);

    if (score > 0) {
      results.push({
        type: "architecture",
        name: arch.project,
        relevance: score,
        summary: `${arch.project} (${arch.status}) — ${arch.description}`,
        data: arch,
      });
    }
  }

  return results;
}

export function registerSearchKnowledge(server: McpServer): void {
  server.tool(
    "hive_search_knowledge",
    "Search across all Hive knowledge — patterns, dependencies, decisions, and architectures. Returns ranked results.",
    {
      query: z.string().describe("Search query (keywords, tags, or natural language)"),
    },
    async ({ query }) => {
      const terms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      if (terms.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Please provide a search query." }],
          isError: true,
        };
      }

      const [patterns, dependencies, decisions, architectures] = await Promise.all([
        searchPatterns(terms),
        searchDependencies(terms),
        searchDecisions(terms),
        searchArchitectures(terms),
      ]);

      const all = [...patterns, ...dependencies, ...decisions, ...architectures].sort(
        (a, b) => b.relevance - a.relevance,
      );

      if (all.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No results found for "${query}".`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query,
                total_results: all.length,
                results: all,
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
