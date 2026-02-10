import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { EvolutionLog, EvolutionEntry } from "../types/meta.js";

export function registerRollbackEvolution(server: McpServer): void {
  server.tool(
    "hive_rollback_evolution",
    "Rollback a self-modification by restoring files from the version snapshot. Updates the evolution log outcome to 'rolled_back'.",
    {
      evolution_id: z.string().describe("Evolution ID to rollback (e.g. 'evo-001')"),
    },
    async ({ evolution_id }) => {
      // Read evolution log
      const evolutionPath = join(HIVE_DIRS.meta, "evolution_log.yaml");

      let evolutionLog: EvolutionLog;
      try {
        evolutionLog = await readYaml<EvolutionLog>(evolutionPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No evolution log found." }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Find the evolution entry
      const entry = evolutionLog.entries.find((e) => e.id === evolution_id);
      if (!entry) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Evolution "${evolution_id}" not found.` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      if (entry.outcome === "rolled_back") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Evolution "${evolution_id}" has already been rolled back.` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Read snapshot manifest
      const snapshotDir = join(HIVE_DIRS.meta, "versions", entry.rollback_version);
      let manifest: { files: Array<{ path: string; action: string }> };
      try {
        manifest = await readYaml<typeof manifest>(join(snapshotDir, "manifest.yaml"));
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Rollback snapshot "${entry.rollback_version}" not found. Manual restoration required.`,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Restore files from snapshot
      const filesRestored: string[] = [];
      for (const file of manifest.files) {
        const snapshotPath = join(snapshotDir, file.path.replace(/\//g, "__"));

        if (file.action === "modified" || file.action === "deleted") {
          // Restore from snapshot
          try {
            const content = await readFile(snapshotPath, "utf-8");
            await writeFile(file.path, content, "utf-8");
            filesRestored.push(file.path);
          } catch {
            // Snapshot file doesn't exist — file may have been created by the evolution
          }
        } else if (file.action === "created") {
          // File was created by the evolution — we note it should be removed
          // but don't delete since the actual file path may be relative to project root
          filesRestored.push(`${file.path} (should be deleted)`);
        }
      }

      // Update evolution outcome
      entry.outcome = "rolled_back";
      await writeYaml(evolutionPath, evolutionLog);

      // Update proposal status back to pending
      try {
        const proposalPath = join(HIVE_DIRS.meta, "proposals", `${entry.proposal_id}.yaml`);
        const proposal = await readYaml<{ status: string }>(proposalPath);
        proposal.status = "pending";
        await writeYaml(proposalPath, proposal);
      } catch {
        // Proposal may not exist
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                rolled_back: true,
                evolution_id,
                files_restored: filesRestored,
                rollback_version: entry.rollback_version,
                current_status: "rolled_back",
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
