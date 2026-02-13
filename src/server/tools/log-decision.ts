import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, decisionsRepo } from "../storage/index.js";

export function registerLogDecision(server: McpServer): void {
  server.tool(
    "hive_log_decision",
    "Record an architectural decision for a project",
    {
      project: z.string().describe("Project slug"),
      component: z.string().describe("Which component this decision relates to"),
      decision: z.string().describe("The decision made"),
      reasoning: z.string().describe("Why this decision was made"),
      alternatives: z.array(z.string()).optional().describe("Alternatives that were considered"),
      revisit_when: z.string().optional().describe("When to revisit this decision"),
    },
    async ({ project, component, decision, reasoning, alternatives, revisit_when }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const entry = decisionsRepo.create(proj.id, {
        date: new Date().toISOString().split("T")[0],
        component,
        decision,
        reasoning,
        alternatives_considered: alternatives,
        revisit_when,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ message: `Decision ${entry.id} logged`, decision: entry }, null, 2),
          },
        ],
      };
    },
  );
}
