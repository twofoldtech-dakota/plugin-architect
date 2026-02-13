import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join, relative } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { projectsRepo } from "../storage/index.js";

async function walkDir(dir: string, basePath: string): Promise<string[]> {
  const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "build", ".hive", "__pycache__", ".venv"]);
  const files: string[] = [];
  let entries: string[];
  try { entries = await readdir(dir); } catch { return files; }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) files.push(...(await walkDir(fullPath, basePath)));
    else files.push(relative(basePath, fullPath));
  }
  return files;
}

function matchesPattern(filePath: string, pattern: string): boolean {
  if (!pattern.includes("*")) return filePath === pattern;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "___DOUBLESTAR___").replace(/\*/g, "[^/]*").replace(/___DOUBLESTAR___/g, ".*");
  return new RegExp(`^${escaped}$`).test(filePath);
}

export function registerDetectDrift(server: McpServer): void {
  server.tool(
    "hive_detect_drift",
    "Detect architecture drift by comparing spec against actual codebase.",
    {
      project: z.string().describe("Project slug"),
      project_path: z.string().describe("Absolute path to the project codebase"),
    },
    { readOnlyHint: true },
    async ({ project, project_path }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };

      const architecture = proj.architecture;
      if (architecture.components.length === 0) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ message: "No components defined.", drift: false }, null, 2) }] };
      }

      const allSpecPatterns: string[] = [];
      for (const comp of architecture.components) allSpecPatterns.push(...comp.files);

      const actualFiles = await walkDir(project_path, project_path);
      const untrackedFiles: string[] = [];
      for (const file of actualFiles) {
        if (!allSpecPatterns.some((p) => matchesPattern(file, p))) untrackedFiles.push(file);
      }

      const missingFromDisk: string[] = [];
      for (const pattern of allSpecPatterns) {
        if (!pattern.includes("*")) { if (!actualFiles.includes(pattern)) missingFromDisk.push(pattern); }
        else { if (!actualFiles.some((f) => matchesPattern(f, pattern))) missingFromDisk.push(pattern); }
      }

      const componentDrift: Array<{ component: string; type: string; expected_files: string[]; actual_files: string[]; extra_files: string[]; missing_files: string[] }> = [];
      for (const comp of architecture.components) {
        const actual: string[] = [];
        const missing: string[] = [];
        for (const pattern of comp.files) {
          const matches = actualFiles.filter((f) => matchesPattern(f, pattern));
          if (matches.length > 0) actual.push(...matches);
          else missing.push(pattern);
        }
        const scopeDirs = new Set(comp.files.map((p) => p.split("/").slice(0, -1).join("/")).filter(Boolean));
        const extra: string[] = [];
        for (const dir of scopeDirs) {
          for (const file of actualFiles) {
            if (file.startsWith(dir + "/") && !actual.includes(file) && !comp.files.some((p) => matchesPattern(file, p))) extra.push(file);
          }
        }
        if (missing.length > 0 || extra.length > 0) componentDrift.push({ component: comp.name, type: comp.type, expected_files: comp.files, actual_files: actual, extra_files: [...new Set(extra)], missing_files: missing });
      }

      const hasDrift = untrackedFiles.length > 0 || missingFromDisk.length > 0 || componentDrift.length > 0;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project, untracked_files: untrackedFiles, missing_from_disk: missingFromDisk, component_drift: componentDrift,
            summary: hasDrift ? `Drift detected: ${untrackedFiles.length} untracked, ${missingFromDisk.length} missing, ${componentDrift.length} component(s) with drift.` : "No drift detected.",
          }, null, 2),
        }],
      };
    },
  );
}
