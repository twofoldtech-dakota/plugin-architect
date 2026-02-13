import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { slugify, patternsRepo } from "../storage/index.js";

export function registerSnapshotPatterns(server: McpServer): void {
  server.tool(
    "hive_snapshot_patterns",
    "Extract files from a project into a reusable pattern in the knowledge base.",
    {
      project: z.string().describe("Project slug (added to pattern's used_in list)"),
      project_path: z.string().describe("Absolute path to the project codebase"),
      files: z.array(z.string()).describe("File paths relative to project_path to include in the pattern"),
      name: z.string().describe("Pattern name"),
      tags: z.array(z.string()).describe("Tags for discovery"),
    },
    async ({ project, project_path, files, name, tags }) => {
      const patternFiles: Array<{ path: string; content: string }> = [];
      const errors: string[] = [];

      for (const filePath of files) {
        try {
          const fullPath = join(project_path, filePath);
          const content = await readFile(fullPath, "utf-8");
          patternFiles.push({ path: filePath, content });
        } catch {
          errors.push(`Could not read: ${filePath}`);
        }
      }

      if (patternFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No files could be read. Errors: ${errors.join(", ")}` }],
          isError: true,
        };
      }

      const slug = slugify(name);
      const now = new Date().toISOString();

      patternsRepo.upsert({
        name,
        slug,
        description: `Pattern extracted from project "${project}"`,
        tags,
        verified: true,
        created: now,
        used_in: [project],
        files: patternFiles,
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `Pattern "${name}" created from ${patternFiles.length} file(s)`,
            slug,
            tags,
            files: patternFiles.map((f) => f.path),
            used_in: [project],
            ...(errors.length > 0 ? { warnings: errors } : {}),
          }, null, 2),
        }],
      };
    },
  );
}
