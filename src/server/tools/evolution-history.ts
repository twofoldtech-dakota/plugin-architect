import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { EvolutionLog } from "../types/meta.js";

export function registerEvolutionHistory(server: McpServer): void {
  server.tool(
    "hive_evolution_history",
    "View the history of Hive self-modifications. Shows evolution entries with type, status, files changed, and outcomes.",
    {
      limit: z.number().optional().default(20).describe("Maximum entries to return (default: 20)"),
    },
    async ({ limit }) => {
      const evolutionPath = join(HIVE_DIRS.meta, "evolution_log.yaml");

      let evolutionLog: EvolutionLog;
      try {
        evolutionLog = await readYaml<EvolutionLog>(evolutionPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                message: "No evolution history found. Hive has not been self-modified yet.",
                entries: [],
                summary: { total: 0, applied: 0, rolled_back: 0, failed: 0 },
              }, null, 2),
            },
          ],
        };
      }

      const entries = evolutionLog.entries.slice(-limit);

      // Compute summary
      const total = evolutionLog.entries.length;
      const applied = evolutionLog.entries.filter((e) => e.outcome === "applied").length;
      const rolledBack = evolutionLog.entries.filter((e) => e.outcome === "rolled_back").length;
      const failed = evolutionLog.entries.filter((e) => e.outcome === "failed").length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                entries: entries.map((e) => ({
                  id: e.id,
                  date: e.date,
                  type: e.type,
                  proposal_id: e.proposal_id,
                  description: e.description,
                  files_changed: e.files_changed.map((f) => ({ path: f.path, action: f.action })),
                  rollback_version: e.rollback_version,
                  outcome: e.outcome,
                })),
                summary: {
                  total,
                  applied,
                  rolled_back: rolledBack,
                  failed,
                  showing: entries.length,
                },
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
