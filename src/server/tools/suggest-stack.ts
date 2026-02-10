import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { PatternIndex } from "../types/pattern.js";

interface StackChoice {
  key: string;
  value: string;
  used_by: string[];
  pattern_support: number;
}

interface StackRecommendation {
  stack: Record<string, string>;
  score: number;
  reasons: string[];
  based_on_projects: string[];
  available_patterns: number;
  preset_match: string | null;
}

function extractTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s_\-/.,;:!?()]+/)
    .filter((t) => t.length > 2);
}

export function registerSuggestStack(server: McpServer): void {
  server.tool(
    "hive_suggest_stack",
    "Recommend a tech stack based on a project description and your history. Analyzes what stacks were used for similar projects, which have the most pattern support, and available presets.",
    {
      description: z.string().describe("Description of what you want to build"),
      constraints: z.array(z.string()).optional().describe("Hard constraints (e.g., ['must use postgres', 'no react'])"),
    },
    async ({ description, constraints }) => {
      const descTerms = extractTerms(description);
      const constraintTerms = (constraints ?? []).map((c) => c.toLowerCase());

      // 1. Analyze stacks from existing projects weighted by relevance
      const stackVotes = new Map<string, { value: string; projects: string[] }[]>();

      try {
        const projectDirs = await readdir(HIVE_DIRS.projects);

        for (const dir of projectDirs) {
          let arch: Architecture;
          try {
            arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
          } catch {
            continue;
          }

          // Score project relevance to description
          const archText = `${arch.project} ${arch.description} ${arch.components.map((c) => `${c.name} ${c.type} ${c.description}`).join(" ")}`;
          const archTerms = extractTerms(archText);
          const overlap = descTerms.filter((t) => archTerms.includes(t));
          if (overlap.length === 0) continue;

          // Collect stack votes from relevant projects
          for (const [key, value] of Object.entries(arch.stack)) {
            if (!stackVotes.has(key)) stackVotes.set(key, []);
            const entries = stackVotes.get(key)!;
            const existing = entries.find((e) => e.value.toLowerCase() === value.toLowerCase());
            if (existing) {
              existing.projects.push(dir);
            } else {
              entries.push({ value, projects: [dir] });
            }
          }
        }
      } catch {
        // no projects
      }

      // 2. Build recommended stack from most-voted choices
      const recommendedStack: Record<string, string> = {};
      const reasons: string[] = [];
      const basedOnProjects = new Set<string>();

      for (const [key, choices] of stackVotes) {
        // Sort by vote count
        choices.sort((a, b) => b.projects.length - a.projects.length);
        const topChoice = choices[0];

        // Check against constraints
        const blocked = constraintTerms.some(
          (c) => c.includes(`no ${topChoice.value.toLowerCase()}`) || c.includes(`no ${key.toLowerCase()}`),
        );
        if (blocked) {
          // Try next best choice
          const alt = choices.find(
            (ch) =>
              !constraintTerms.some(
                (c) => c.includes(`no ${ch.value.toLowerCase()}`),
              ),
          );
          if (alt) {
            recommendedStack[key] = alt.value;
            alt.projects.forEach((p) => basedOnProjects.add(p));
            reasons.push(`${key}: ${alt.value} (used in ${alt.projects.length} similar project(s), top choice was constrained out)`);
          }
          continue;
        }

        // Check if constraint requires a specific value for this key
        const required = constraintTerms.find(
          (c) => c.includes(`must use`) && extractTerms(c).some((t) => t === key.toLowerCase()),
        );
        if (required) {
          const requiredValue = extractTerms(required).find((t) => t !== "must" && t !== "use" && t !== key.toLowerCase());
          if (requiredValue) {
            recommendedStack[key] = requiredValue;
            reasons.push(`${key}: ${requiredValue} (required by constraint)`);
            continue;
          }
        }

        recommendedStack[key] = topChoice.value;
        topChoice.projects.forEach((p) => basedOnProjects.add(p));
        reasons.push(`${key}: ${topChoice.value} (used in ${topChoice.projects.length} similar project(s))`);
      }

      // 3. Check for matching stack presets
      let presetMatch: string | null = null;
      try {
        const presetFiles = await readdir(HIVE_DIRS.stacks);
        for (const file of presetFiles) {
          if (!file.endsWith(".yaml")) continue;
          try {
            const preset = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.stacks, file));
            const presetText = JSON.stringify(preset).toLowerCase();
            const stackValues = Object.values(recommendedStack).map((v) => v.toLowerCase());
            const overlap = stackValues.filter((v) => presetText.includes(v));
            if (overlap.length >= 2) {
              presetMatch = file.replace(".yaml", "");
              reasons.push(`Matches stack preset: ${presetMatch}`);
              break;
            }
          } catch {
            // skip
          }
        }
      } catch {
        // no presets
      }

      // 4. Count available patterns for this stack
      let patternSupport = 0;
      try {
        const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
        const stackValues = Object.values(recommendedStack).map((v) => v.toLowerCase());
        for (const entry of index.patterns) {
          const hasOverlap = entry.tags.some((t) => stackValues.includes(t.toLowerCase()));
          if (hasOverlap) patternSupport++;
        }
      } catch {
        // no patterns
      }

      if (Object.keys(recommendedStack).length === 0) {
        // No project history to base recommendation on — check presets instead
        const presetRecommendations: Array<{ name: string; description: string }> = [];
        try {
          const presetFiles = await readdir(HIVE_DIRS.stacks);
          for (const file of presetFiles) {
            if (!file.endsWith(".yaml")) continue;
            try {
              const preset = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.stacks, file));
              presetRecommendations.push({
                name: file.replace(".yaml", ""),
                description: (preset.description as string) ?? "No description",
              });
            } catch {
              // skip
            }
          }
        } catch {
          // no presets
        }

        if (presetRecommendations.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: "No similar projects found to base a recommendation on. Consider these stack presets:",
                    presets: presetRecommendations,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: "No project history or stack presets to base a recommendation on. Register some projects and patterns first.",
            },
          ],
        };
      }

      const recommendation: StackRecommendation = {
        stack: recommendedStack,
        score: Object.keys(recommendedStack).length * 2 + patternSupport + basedOnProjects.size,
        reasons,
        based_on_projects: [...basedOnProjects],
        available_patterns: patternSupport,
        preset_match: presetMatch,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(recommendation, null, 2) }],
      };
    },
  );
}
