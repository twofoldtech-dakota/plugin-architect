import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join, relative } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";

interface DriftReport {
  project: string;
  untracked_files: string[];
  missing_from_disk: string[];
  component_drift: ComponentDrift[];
  summary: string;
}

interface ComponentDrift {
  component: string;
  type: string;
  expected_files: string[];
  actual_files: string[];
  extra_files: string[];
  missing_files: string[];
}

/**
 * Recursively walk a directory and return all file paths relative to basePath.
 * Skips common non-source directories.
 */
async function walkDir(dir: string, basePath: string): Promise<string[]> {
  const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "build", ".hive", "__pycache__", ".venv"]);
  const files: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...(await walkDir(fullPath, basePath)));
    } else {
      files.push(relative(basePath, fullPath));
    }
  }

  return files;
}

/**
 * Check if a file path matches a pattern (supports trailing * and **).
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return filePath === pattern;
  }
  // Convert glob pattern to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "___DOUBLESTAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLESTAR___/g, ".*");
  return new RegExp(`^${escaped}$`).test(filePath);
}

export function registerDetectDrift(server: McpServer): void {
  server.tool(
    "hive_detect_drift",
    "Detect architecture drift by comparing the project's architecture spec against the actual codebase. Flags files that exist on disk but aren't in the spec, and spec entries missing from disk.",
    {
      project: z.string().describe("Project slug"),
      project_path: z.string().describe("Absolute path to the actual project codebase on disk"),
    },
    async ({ project, project_path }) => {
      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(join(HIVE_DIRS.projects, safeName(project), "architecture.yaml"));
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
              text: JSON.stringify({ message: "No components defined in the architecture. Add components first.", drift: false }, null, 2),
            },
          ],
        };
      }

      // Collect all spec file patterns
      const allSpecPatterns: string[] = [];
      for (const comp of architecture.components) {
        allSpecPatterns.push(...comp.files);
      }

      // Walk the actual codebase
      const actualFiles = await walkDir(project_path, project_path);

      // Find files on disk that don't match any spec pattern
      const trackedFiles = new Set<string>();
      const untrackedFiles: string[] = [];

      for (const file of actualFiles) {
        const matched = allSpecPatterns.some((pattern) => matchesPattern(file, pattern));
        if (matched) {
          trackedFiles.add(file);
        } else {
          untrackedFiles.push(file);
        }
      }

      // Find spec entries with no matching files on disk
      const missingFromDisk: string[] = [];
      for (const pattern of allSpecPatterns) {
        if (!pattern.includes("*")) {
          // Exact path — check directly
          if (!actualFiles.includes(pattern)) {
            missingFromDisk.push(pattern);
          }
        } else {
          // Glob — check if any actual file matches
          const hasMatch = actualFiles.some((f) => matchesPattern(f, pattern));
          if (!hasMatch) {
            missingFromDisk.push(pattern);
          }
        }
      }

      // Per-component drift analysis
      const componentDrift: ComponentDrift[] = [];
      for (const comp of architecture.components) {
        const expectedFiles = comp.files;
        const actual: string[] = [];
        const extra: string[] = [];
        const missing: string[] = [];

        for (const pattern of expectedFiles) {
          const matches = actualFiles.filter((f) => matchesPattern(f, pattern));
          if (matches.length > 0) {
            actual.push(...matches);
          } else {
            missing.push(pattern);
          }
        }

        // Find files in the component's directory scope that aren't in the spec
        // Infer directory scope from file patterns
        const scopeDirs = new Set<string>();
        for (const pattern of expectedFiles) {
          const dir = pattern.split("/").slice(0, -1).join("/");
          if (dir) scopeDirs.add(dir);
        }

        for (const dir of scopeDirs) {
          for (const file of actualFiles) {
            if (file.startsWith(dir + "/") && !actual.includes(file)) {
              const isInSpec = expectedFiles.some((p) => matchesPattern(file, p));
              if (!isInSpec) {
                extra.push(file);
              }
            }
          }
        }

        if (missing.length > 0 || extra.length > 0) {
          componentDrift.push({
            component: comp.name,
            type: comp.type,
            expected_files: expectedFiles,
            actual_files: actual,
            extra_files: [...new Set(extra)],
            missing_files: missing,
          });
        }
      }

      const hasDrift = untrackedFiles.length > 0 || missingFromDisk.length > 0 || componentDrift.length > 0;

      const report: DriftReport = {
        project,
        untracked_files: untrackedFiles,
        missing_from_disk: missingFromDisk,
        component_drift: componentDrift,
        summary: hasDrift
          ? `Drift detected: ${untrackedFiles.length} untracked file(s), ${missingFromDisk.length} missing from disk, ${componentDrift.length} component(s) with drift.`
          : "No drift detected. Codebase aligns with architecture spec.",
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    },
  );
}
