import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { slugify, patternsRepo } from "../storage/index.js";

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
      const now = new Date().toISOString();

      patternsRepo.upsert({
        name,
        slug,
        description,
        tags,
        verified: true,
        created: now,
        used_in: [],
        files,
        notes,
      });

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
