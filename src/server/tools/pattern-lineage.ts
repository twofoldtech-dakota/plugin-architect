import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { patternsRepo, projectsRepo } from "../storage/index.js";

export function registerPatternLineage(server: McpServer): void {
  server.tool(
    "hive_pattern_lineage",
    "Track the version history and cross-project usage of a pattern.",
    { pattern: z.string().describe("Pattern slug") },
    async ({ pattern: slug }) => {
      const patternData = patternsRepo.getBySlug(slug);
      if (!patternData) return { content: [{ type: "text" as const, text: `Pattern "${slug}" not found.` }], isError: true };

      const projectUsages: Array<{ project: string; stack: Record<string, string>; status: string }> = [];
      for (const projectSlug of patternData.used_in ?? []) {
        const proj = projectsRepo.getBySlug(projectSlug);
        if (proj) projectUsages.push({ project: projectSlug, stack: proj.architecture.stack, status: proj.architecture.status });
        else projectUsages.push({ project: projectSlug, stack: {}, status: "unknown" });
      }

      // Also scan all projects for references
      const knownProjects = new Set(patternData.used_in ?? []);
      for (const proj of projectsRepo.list()) {
        if (knownProjects.has(proj.slug)) continue;
        const archText = JSON.stringify(proj.architecture).toLowerCase();
        if (archText.includes(slug)) projectUsages.push({ project: proj.slug, stack: proj.architecture.stack, status: proj.architecture.status });
      }

      const version = patternData.version ?? 1;
      const lineage = patternData.lineage ?? [];
      let summary: string;
      if (lineage.length === 0 && projectUsages.length === 0) summary = `Pattern "${patternData.name}" created on ${patternData.created}, not yet used.`;
      else if (lineage.length === 0) summary = `Pattern "${patternData.name}" (v${version}) used in ${projectUsages.length} project(s).`;
      else { const latest = lineage[lineage.length - 1]; summary = `Pattern "${patternData.name}" v${version}, ${lineage.length} change(s), ${projectUsages.length} project(s). Last: ${latest.date} — ${latest.changes}`; }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ slug, name: patternData.name, description: patternData.description, created: patternData.created, version, total_usages: projectUsages.length, lineage, project_usages: projectUsages, evolution_summary: summary }, null, 2) }],
      };
    },
  );
}
