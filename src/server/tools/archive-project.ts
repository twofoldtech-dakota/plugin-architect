import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, decisionsRepo, patternsRepo, dependenciesRepo } from "../storage/index.js";

export function registerArchiveProject(server: McpServer): void {
  server.tool(
    "hive_archive_project",
    "Archive a project. Sets status to archived, logs the decision, and summarizes preserved knowledge.",
    {
      project: z.string().describe("Project slug"),
      reason: z.string().optional().describe("Reason for archiving"),
    },
    { destructiveHint: true },
    async ({ project, reason }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      if (proj.architecture.status === "archived") {
        return { content: [{ type: "text" as const, text: `Project "${project}" is already archived.` }], isError: true };
      }

      // Update architecture status
      const arch = proj.architecture;
      arch.status = "archived";
      projectsRepo.updateArchitecture(project, arch);

      // Log archival decision
      decisionsRepo.create(proj.id, {
        date: new Date().toISOString(),
        component: "project",
        decision: "Archive project",
        reasoning: reason ?? "Project archived by user",
        alternatives_considered: [],
      });

      // Count preserved knowledge
      const allPatterns = patternsRepo.list();
      const patternsCount = allPatterns.filter((p) => p.used_in?.includes(project)).length;
      const decisions = decisionsRepo.listByProject(proj.id);
      const decisionsCount = decisions.length;
      const depsCount = dependenciesRepo.list().length;

      const preservation = {
        patterns_extracted: patternsCount,
        decisions_logged: decisionsCount,
        dependencies_registered: depsCount,
      };

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `Project "${project}" archived`,
            reason: reason ?? "No reason provided",
            knowledge_preserved: preservation,
          }, null, 2),
        }],
      };
    },
  );
}
