import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Proposal, EvolutionLog, EvolutionEntry, EvolutionFileChange } from "../types/meta.js";

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

export function registerEvolve(server: McpServer): void {
  server.tool(
    "hive_evolve",
    "Apply a pending or approved proposal to evolve Hive. Creates a rollback snapshot, applies changes, logs the evolution. Supports dry-run mode to preview changes without applying.",
    {
      proposal_id: z.string().describe("Proposal ID to apply (e.g. 'prop-001')"),
      dry_run: z.boolean().optional().default(false).describe("If true, show what would change without applying"),
    },
    async ({ proposal_id, dry_run }) => {
      // Read proposal
      const proposalPath = join(HIVE_DIRS.meta, "proposals", `${proposal_id}.yaml`);

      let proposal: Proposal;
      try {
        proposal = await readYaml<Proposal>(proposalPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Proposal "${proposal_id}" not found.` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      if (proposal.status !== "pending" && proposal.status !== "approved") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Proposal "${proposal_id}" has status "${proposal.status}" — only "pending" or "approved" proposals can be applied.`,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Determine files that would change based on proposal type
      const filesChanged: EvolutionFileChange[] = [];

      switch (proposal.type) {
        case "new_tool": {
          const toolName = proposal.target ?? proposal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          filesChanged.push({
            path: `src/server/tools/${toolName}.ts`,
            action: "created",
          });
          filesChanged.push({
            path: "src/server/tools/index.ts",
            action: "modified",
          });
          break;
        }

        case "refactor_tool": {
          if (proposal.target) {
            const toolFile = proposal.target.replace("hive_", "").replace(/_/g, "-");
            filesChanged.push({
              path: `src/server/tools/${toolFile}.ts`,
              action: "modified",
            });
          }
          break;
        }

        case "remove_tool": {
          if (proposal.target) {
            const toolFile = proposal.target.replace("hive_", "").replace(/_/g, "-");
            filesChanged.push({
              path: `src/server/tools/${toolFile}.ts`,
              action: "deleted",
            });
            filesChanged.push({
              path: "src/server/tools/index.ts",
              action: "modified",
            });
          }
          break;
        }

        case "schema_change": {
          filesChanged.push({
            path: "src/server/types/",
            action: "modified",
          });
          break;
        }

        case "ui_change": {
          filesChanged.push({
            path: "src/ui/views/",
            action: "modified",
          });
          break;
        }
      }

      if (dry_run) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  dry_run: true,
                  proposal_id,
                  proposal_type: proposal.type,
                  proposal_name: proposal.name,
                  files_would_change: filesChanged,
                  implementation_plan: proposal.implementation_plan,
                  estimated_effort: proposal.estimated_effort,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Create rollback snapshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const snapshotDir = join(HIVE_DIRS.meta, "versions", timestamp);
      await mkdir(snapshotDir, { recursive: true });

      // Snapshot existing files that will be modified/deleted
      for (const fc of filesChanged) {
        if (fc.action === "modified" || fc.action === "deleted") {
          const content = await safeReadFile(fc.path);
          if (content !== null) {
            fc.previous_content = content;
            const snapshotPath = join(snapshotDir, fc.path.replace(/\//g, "__"));
            await writeFile(snapshotPath, content, "utf-8");
          }
        }
      }

      // Save snapshot metadata
      await writeYaml(join(snapshotDir, "manifest.yaml"), {
        proposal_id,
        timestamp,
        files: filesChanged.map((f) => ({ path: f.path, action: f.action })),
      });

      // Read evolution log
      const evolutionPath = join(HIVE_DIRS.meta, "evolution_log.yaml");
      let evolutionLog: EvolutionLog;
      try {
        evolutionLog = await readYaml<EvolutionLog>(evolutionPath);
      } catch {
        evolutionLog = { entries: [] };
      }

      const evolutionId = `evo-${String(evolutionLog.entries.length + 1).padStart(3, "0")}`;

      // Log the evolution entry
      // Note: actual code generation/application is left to the user or a coding agent.
      // This tool records the intent, creates the rollback point, and tracks the evolution.
      const entry: EvolutionEntry = {
        id: evolutionId,
        date: new Date().toISOString().split("T")[0],
        type: proposal.type,
        proposal_id,
        description: proposal.description,
        files_changed: filesChanged.map((f) => ({ path: f.path, action: f.action })),
        rollback_version: timestamp,
        outcome: "applied",
      };

      evolutionLog.entries.push(entry);
      await writeYaml(evolutionPath, evolutionLog);

      // Update proposal status
      proposal.status = "applied";
      await writeYaml(proposalPath, proposal);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                evolution_id: evolutionId,
                proposal_id,
                files_changed: filesChanged.map((f) => ({ path: f.path, action: f.action })),
                rollback_version: timestamp,
                status: "applied",
                implementation_plan: proposal.implementation_plan,
                message: "Evolution recorded. Use the implementation plan to make the actual code changes. Rollback snapshot created.",
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
