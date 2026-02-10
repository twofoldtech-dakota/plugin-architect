import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { access, readdir, stat } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture, Component } from "../types/architecture.js";

type ComponentStatus = "built" | "in_progress" | "missing";

interface ComponentProgress {
  name: string;
  type: string;
  status: ComponentStatus;
  expected_files: string[];
  found_files: string[];
  missing_files: string[];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Expand simple glob patterns into matching file paths.
 * Supports trailing `*` (e.g., "src/components/*") and `**` patterns.
 * Falls back to exact match for non-glob paths.
 */
async function expandGlob(basePath: string, pattern: string): Promise<string[]> {
  const fullPath = join(basePath, pattern);

  // No glob — check exact path
  if (!pattern.includes("*")) {
    if (await exists(fullPath)) return [pattern];
    return [];
  }

  // Simple trailing wildcard: "dir/*"
  const parts = pattern.split("*");
  const prefix = parts[0];
  const prefixPath = join(basePath, prefix);

  try {
    const info = await stat(prefixPath);
    if (!info.isDirectory()) return [];
  } catch {
    return [];
  }

  const found: string[] = [];

  async function walk(dir: string, relDir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = join(dir, entry);
      const relPath = join(relDir, entry);
      const info = await stat(entryPath);
      found.push(relPath);
      if (info.isDirectory()) {
        await walk(entryPath, relPath);
      }
    }
  }

  await walk(prefixPath, prefix);
  return found;
}

function classifyComponent(expected: number, found: number): ComponentStatus {
  if (found === 0) return "missing";
  if (found >= expected) return "built";
  return "in_progress";
}

export function registerCheckProgress(server: McpServer): void {
  server.tool(
    "hive_check_progress",
    "Check build progress by comparing the project's architecture spec against the actual codebase on disk.",
    {
      project: z.string().describe("Project slug"),
      project_path: z.string().describe("Absolute path to the actual project codebase on disk"),
    },
    async ({ project, project_path }) => {
      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(HIVE_DIRS.projects, project, "architecture.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      if (architecture.components.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { message: "No components defined in the architecture. Add components first.", built: [], in_progress: [], missing: [], coverage_pct: 0 },
                null,
                2,
              ),
            },
          ],
        };
      }

      const built: ComponentProgress[] = [];
      const in_progress: ComponentProgress[] = [];
      const missing: ComponentProgress[] = [];

      for (const component of architecture.components) {
        const foundFiles: string[] = [];
        const missingFiles: string[] = [];

        for (const filePattern of component.files) {
          const expanded = await expandGlob(project_path, filePattern);
          if (expanded.length > 0) {
            foundFiles.push(...expanded);
          } else {
            missingFiles.push(filePattern);
          }
        }

        const status = classifyComponent(component.files.length, component.files.length - missingFiles.length);

        const progress: ComponentProgress = {
          name: component.name,
          type: component.type,
          status,
          expected_files: component.files,
          found_files: foundFiles,
          missing_files: missingFiles,
        };

        if (status === "built") built.push(progress);
        else if (status === "in_progress") in_progress.push(progress);
        else missing.push(progress);
      }

      const total = architecture.components.length;
      const coverage_pct = total > 0 ? Math.round((built.length / total) * 100) : 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ built, in_progress, missing, coverage_pct }, null, 2),
          },
        ],
      };
    },
  );
}
