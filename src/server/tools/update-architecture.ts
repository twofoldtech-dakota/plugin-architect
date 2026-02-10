import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import { appendDecision } from "./log-decision.js";

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    if (
      tVal && sVal &&
      typeof tVal === "object" && !Array.isArray(tVal) &&
      typeof sVal === "object" && !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(tVal as Record<string, unknown>, sVal as Record<string, unknown>);
    } else {
      result[key] = sVal;
    }
  }
  return result;
}

export function registerUpdateArchitecture(server: McpServer): void {
  server.tool(
    "hive_update_architecture",
    "Update the architecture doc as the project evolves. Deep-merges updates into the existing doc. Optionally auto-logs a decision.",
    {
      project: z.string().describe("Project slug"),
      updates: z.record(z.string(), z.unknown()).describe("Partial update to merge into architecture"),
      reason: z.string().optional().describe("Why this changed (auto-logged to decisions)"),
    },
    async ({ project, updates, reason }) => {
      const projectDir = join(HIVE_DIRS.projects, safeName(project));
      const archPath = join(projectDir, "architecture.yaml");

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(archPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const merged = deepMerge(
        architecture as unknown as Record<string, unknown>,
        updates,
      ) as unknown as Architecture;

      merged.updated = new Date().toISOString().split("T")[0];

      await writeYaml(archPath, merged);

      if (reason) {
        const decisionsPath = join(projectDir, "decisions.yaml");
        let log: DecisionLog = { decisions: [] };
        try {
          log = await readYaml<DecisionLog>(decisionsPath);
        } catch {
          // Fresh log
        }
        appendDecision(log, {
          component: "architecture",
          decision: reason,
          reasoning: `Auto-logged from architecture update`,
        });
        await writeYaml(decisionsPath, log);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(merged, null, 2),
          },
        ],
      };
    },
  );
}
