import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";
import type { Architecture } from "../types/architecture.js";

interface ProjectUsage {
  project: string;
  stack: Record<string, string>;
  status: string;
}

interface LineageResult {
  slug: string;
  name: string;
  description: string;
  created: string;
  version: number;
  total_usages: number;
  lineage: Pattern["lineage"];
  project_usages: ProjectUsage[];
  evolution_summary: string;
}

export function registerPatternLineage(server: McpServer): void {
  server.tool(
    "hive_pattern_lineage",
    "Track the version history and cross-project usage of a pattern. Shows how the pattern has evolved and which projects use it.",
    {
      pattern: z.string().describe("Pattern slug"),
    },
    async ({ pattern: slug }) => {
      let patternData: Pattern;
      try {
        patternData = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${slug}.yaml`));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Pattern "${slug}" not found.` }],
          isError: true,
        };
      }

      // Gather project usage details
      const projectUsages: ProjectUsage[] = [];
      for (const projectSlug of patternData.used_in ?? []) {
        try {
          const arch = await readYaml<Architecture>(
            join(HIVE_DIRS.projects, projectSlug, "architecture.yaml"),
          );
          projectUsages.push({
            project: projectSlug,
            stack: arch.stack,
            status: arch.status,
          });
        } catch {
          projectUsages.push({ project: projectSlug, stack: {}, status: "unknown" });
        }
      }

      // Also scan all projects to find any that reference this pattern but aren't in used_in
      try {
        const allProjects = await readdir(HIVE_DIRS.projects);
        const knownProjects = new Set(patternData.used_in ?? []);
        for (const projectSlug of allProjects) {
          if (knownProjects.has(projectSlug)) continue;
          try {
            const arch = await readYaml<Architecture>(
              join(HIVE_DIRS.projects, projectSlug, "architecture.yaml"),
            );
            const archText = JSON.stringify(arch).toLowerCase();
            if (archText.includes(slug)) {
              projectUsages.push({
                project: projectSlug,
                stack: arch.stack,
                status: arch.status,
              });
            }
          } catch {
            // skip
          }
        }
      } catch {
        // no projects dir
      }

      const version = patternData.version ?? 1;
      const lineage = patternData.lineage ?? [];

      // Build evolution summary
      let summary: string;
      if (lineage.length === 0 && projectUsages.length === 0) {
        summary = `Pattern "${patternData.name}" was created on ${patternData.created} and has not been used in any projects yet.`;
      } else if (lineage.length === 0) {
        summary = `Pattern "${patternData.name}" (v${version}) has been used in ${projectUsages.length} project(s) since ${patternData.created}. No version history recorded.`;
      } else {
        const latestChange = lineage[lineage.length - 1];
        summary = `Pattern "${patternData.name}" is on version ${version} with ${lineage.length} recorded change(s) across ${projectUsages.length} project(s). Last updated: ${latestChange.date} from project "${latestChange.project}" — ${latestChange.changes}`;
      }

      const result: LineageResult = {
        slug,
        name: patternData.name,
        description: patternData.description,
        created: patternData.created,
        version,
        total_usages: projectUsages.length,
        lineage,
        project_usages: projectUsages,
        evolution_summary: summary,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
