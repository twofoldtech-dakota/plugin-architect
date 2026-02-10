import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Decision, DecisionLog } from "../types/architecture.js";

/**
 * Append a decision to a DecisionLog (mutates the log).
 * Reusable by other tools (e.g., update-architecture).
 */
export function appendDecision(
  log: DecisionLog,
  fields: { component: string; decision: string; reasoning: string; alternatives?: string[]; revisit_when?: string },
): Decision {
  const nextId = String(log.decisions.length + 1).padStart(3, "0");
  const now = new Date().toISOString().split("T")[0];

  const entry: Decision = {
    id: nextId,
    date: now,
    component: fields.component,
    decision: fields.decision,
    reasoning: fields.reasoning,
    alternatives_considered: fields.alternatives,
    revisit_when: fields.revisit_when,
  };

  log.decisions.push(entry);
  return entry;
}

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
      const decisionsPath = join(HIVE_DIRS.projects, project, "decisions.yaml");

      let log: DecisionLog;
      try {
        log = await readYaml<DecisionLog>(decisionsPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const entry = appendDecision(log, { component, decision, reasoning, alternatives, revisit_when });
      await writeYaml(decisionsPath, log);

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
