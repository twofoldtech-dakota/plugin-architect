import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import { appendDecision } from "./log-decision.js";

export function registerArchiveProject(server: McpServer): void {
  server.tool(
    "hive_archive_project",
    "Archive a project. Sets status to archived, logs the decision, and summarizes preserved knowledge.",
    {
      project: z.string().describe("Project slug"),
      reason: z.string().optional().describe("Reason for archiving"),
    },
    async ({ project, reason }) => {
      const archPath = join(HIVE_DIRS.projects, project, "architecture.yaml");
      const decisionsPath = join(HIVE_DIRS.projects, project, "decisions.yaml");

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(archPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      if (architecture.status === "archived") {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" is already archived.` }],
          isError: true,
        };
      }

      // Update architecture status
      architecture.status = "archived";
      architecture.updated = new Date().toISOString().split("T")[0];
      await writeYaml(archPath, architecture);

      // Log archival decision
      let log: DecisionLog;
      try {
        log = await readYaml<DecisionLog>(decisionsPath);
      } catch {
        log = { decisions: [] };
      }

      appendDecision(log, {
        component: "project",
        decision: "Archive project",
        reasoning: reason ?? "Project archived by user",
      });
      await writeYaml(decisionsPath, log);

      // Count preserved knowledge
      let patternsCount = 0;
      try {
        const indexPath = join(HIVE_DIRS.patterns, "index.yaml");
        const index = await readYaml<{ patterns: Array<{ used_in?: string[] }> }>(indexPath);
        patternsCount = index.patterns.filter((p) => p.used_in?.includes(project)).length;
      } catch {
        // No patterns index
      }

      const decisionsCount = log.decisions.length;

      let depsCount = 0;
      try {
        const depDirs = await readdir(HIVE_DIRS.dependencies);
        depsCount = depDirs.length;
      } catch {
        // No deps registered
      }

      const preservation = {
        patterns_extracted: patternsCount,
        decisions_logged: decisionsCount,
        dependencies_registered: depsCount,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Project "${project}" archived`,
                reason: reason ?? "No reason provided",
                knowledge_preserved: preservation,
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
