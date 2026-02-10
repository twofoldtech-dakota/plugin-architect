import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

export function registerRegisterPattern(server: McpServer): void {
  server.tool(
    "hive_register_pattern",
    "Save a verified code pattern to the knowledge base. Patterns are reusable across projects.",
    {
      name: z.string().describe("Pattern name"),
      description: z.string().describe("What this pattern does"),
      tags: z.array(z.string()).describe("Tags for discovery (e.g., ['database', 'drizzle', 'sqlite'])"),
      files: z
        .array(
          z.object({
            path: z.string().describe("File path within the pattern"),
            content: z.string().describe("File content"),
          }),
        )
        .describe("Pattern files with content"),
      notes: z.string().optional().describe("Usage notes or gotchas"),
    },
    async ({ name, description, tags, files, notes }) => {
      const slug = slugify(name);
      const now = new Date().toISOString().split("T")[0];

      const pattern: Pattern = {
        name,
        slug,
        description,
        tags,
        verified: true,
        created: now,
        used_in: [],
        files,
        notes,
      };

      await writeYaml(join(HIVE_DIRS.patterns, `${slug}.yaml`), pattern);

      // Update pattern index
      const indexPath = join(HIVE_DIRS.patterns, "index.yaml");
      let index: PatternIndex;
      try {
        index = await readYaml<PatternIndex>(indexPath);
      } catch {
        index = { patterns: [] };
      }

      // Remove existing entry if re-registering
      index.patterns = index.patterns.filter((p) => p.slug !== slug);
      index.patterns.push({ slug, name, tags });

      await writeYaml(indexPath, index);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ message: `Pattern "${name}" registered`, slug, tags }, null, 2),
          },
        ],
      };
    },
  );
}
