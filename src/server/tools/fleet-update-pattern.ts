import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Pattern } from "../types/pattern.js";
import type { DecisionLog } from "../types/architecture.js";

interface UpdatePreview {
  project: string;
  files: Array<{
    path: string;
    status: "would_create" | "would_update" | "unchanged";
    diff_summary?: string;
  }>;
}

interface AppliedResult {
  project: string;
  files_updated: string[];
  decision_logged: boolean;
}

async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

export function registerFleetUpdatePattern(server: McpServer): void {
  server.tool(
    "hive_fleet_update_pattern",
    "Update a pattern across all projects that use it. Supports dry-run mode to preview changes before applying.",
    {
      pattern: z.string().describe("Pattern slug to update across projects"),
      dry_run: z.boolean().optional().default(true).describe("If true, show what would change without applying (default: true)"),
    },
    async ({ pattern: patternSlug, dry_run }) => {
      // Read the pattern
      const patternPath = join(HIVE_DIRS.patterns, `${patternSlug}.yaml`);
      let patternData: Pattern;
      try {
        patternData = await readYaml<Pattern>(patternPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Pattern "${patternSlug}" not found.` }],
          isError: true,
        };
      }

      if (!patternData.used_in || patternData.used_in.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { message: `Pattern "${patternSlug}" has no projects in its used_in list.`, affected_projects: 0 },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (dry_run) {
        const previews: UpdatePreview[] = [];

        for (const project of patternData.used_in) {
          const projDir = join(HIVE_DIRS.projects, project);
          // Read architecture to find project_path hint
          const arch = await readYaml<{ project_path?: string }>(join(projDir, "architecture.yaml")).catch(() => null);
          const basePath = (arch as { project_path?: string } | null)?.project_path;

          const files: UpdatePreview["files"] = [];
          for (const pFile of patternData.files) {
            if (basePath) {
              const existingContent = await safeReadFile(join(basePath, pFile.path));
              if (existingContent === null) {
                files.push({ path: pFile.path, status: "would_create" });
              } else if (existingContent !== pFile.content) {
                files.push({ path: pFile.path, status: "would_update", diff_summary: "Content differs from pattern" });
              } else {
                files.push({ path: pFile.path, status: "unchanged" });
              }
            } else {
              files.push({ path: pFile.path, status: "would_update", diff_summary: "Cannot verify — no project_path in architecture" });
            }
          }

          previews.push({ project, files });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  mode: "dry_run",
                  pattern: patternSlug,
                  affected_projects: previews.length,
                  previews,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Apply updates
      const applied: AppliedResult[] = [];

      for (const project of patternData.used_in) {
        const projDir = join(HIVE_DIRS.projects, project);
        const arch = await readYaml<{ project_path?: string }>(join(projDir, "architecture.yaml")).catch(() => null);
        const basePath = (arch as { project_path?: string } | null)?.project_path;

        if (!basePath) {
          applied.push({ project, files_updated: [], decision_logged: false });
          continue;
        }

        const updatedFiles: string[] = [];
        const { writeFile: fsWriteFile, mkdir } = await import("node:fs/promises");
        const { dirname } = await import("node:path");

        for (const pFile of patternData.files) {
          const targetPath = join(basePath, pFile.path);
          await mkdir(dirname(targetPath), { recursive: true });
          await fsWriteFile(targetPath, pFile.content, "utf-8");
          updatedFiles.push(pFile.path);
        }

        // Log decision
        let decisionLogged = false;
        try {
          const decisionsPath = join(projDir, "decisions.yaml");
          let log: DecisionLog;
          try {
            log = await readYaml<DecisionLog>(decisionsPath);
          } catch {
            log = { decisions: [] };
          }

          const nextId = String(log.decisions.length + 1).padStart(3, "0");
          log.decisions.push({
            id: nextId,
            date: new Date().toISOString().split("T")[0],
            component: "patterns",
            decision: `Updated pattern "${patternSlug}" across fleet`,
            reasoning: `Fleet-wide pattern update applied ${updatedFiles.length} files`,
          });
          await writeYaml(decisionsPath, log);
          decisionLogged = true;
        } catch {
          // Decision logging failed — not critical
        }

        applied.push({ project, files_updated: updatedFiles, decision_logged: decisionLogged });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                mode: "applied",
                pattern: patternSlug,
                affected_projects: applied.length,
                results: applied,
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
