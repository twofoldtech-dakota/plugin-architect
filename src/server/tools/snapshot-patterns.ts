import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

export function registerSnapshotPatterns(server: McpServer): void {
  server.tool(
    "hive_snapshot_patterns",
    "Extract files from a project into a reusable pattern in the knowledge base.",
    {
      project: z.string().describe("Project slug (added to pattern's used_in list)"),
      project_path: z.string().describe("Absolute path to the project codebase"),
      files: z.array(z.string()).describe("File paths relative to project_path to include in the pattern"),
      name: z.string().describe("Pattern name"),
      tags: z.array(z.string()).describe("Tags for discovery (e.g., ['auth', 'jwt', 'middleware'])"),
    },
    async ({ project, project_path, files, name, tags }) => {
      // Read each specified file from the project
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
          content: [
            {
              type: "text" as const,
              text: `No files could be read. Errors: ${errors.join(", ")}`,
            },
          ],
          isError: true,
        };
      }

      const slug = slugify(name);
      const now = new Date().toISOString().split("T")[0];

      const pattern: Pattern = {
        name,
        slug,
        description: `Pattern extracted from project "${project}"`,
        tags,
        verified: true,
        created: now,
        used_in: [project],
        files: patternFiles,
      };

      // Write pattern YAML
      await writeYaml(join(HIVE_DIRS.patterns, `${slug}.yaml`), pattern);

      // Update pattern index
      const indexPath = join(HIVE_DIRS.patterns, "index.yaml");
      let index: PatternIndex;
      try {
        index = await readYaml<PatternIndex>(indexPath);
      } catch {
        index = { patterns: [] };
      }

      index.patterns = index.patterns.filter((p) => p.slug !== slug);
      index.patterns.push({ slug, name, tags });
      await writeYaml(indexPath, index);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Pattern "${name}" created from ${patternFiles.length} file(s)`,
                slug,
                tags,
                files: patternFiles.map((f) => f.path),
                used_in: [project],
                ...(errors.length > 0 ? { warnings: errors } : {}),
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
