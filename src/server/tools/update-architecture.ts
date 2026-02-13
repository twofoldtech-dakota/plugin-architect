import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, decisionsRepo } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

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
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const merged = deepMerge(
        proj.architecture as unknown as Record<string, unknown>,
        updates,
      ) as unknown as Architecture;

      merged.updated = new Date().toISOString().split("T")[0];

      projectsRepo.updateArchitecture(project, merged);

      if (reason) {
        decisionsRepo.create(proj.id, {
          date: new Date().toISOString().split("T")[0],
          component: "architecture",
          decision: reason,
          reasoning: "Auto-logged from architecture update",
        });
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
