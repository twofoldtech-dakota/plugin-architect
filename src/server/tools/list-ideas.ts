import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Idea } from "../types/idea.js";

export function registerListIdeas(server: McpServer): void {
  server.tool(
    "hive_list_ideas",
    "List all captured ideas with their status and verdict",
    {
      status: z
        .enum(["raw", "evaluated", "approved", "rejected", "parked"])
        .optional()
        .describe("Filter by status"),
    },
    async ({ status }) => {
      let files: string[];
      try {
        files = await readdir(HIVE_DIRS.ideas);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No ideas found." }],
        };
      }

      const yamlFiles = files.filter((f) => f.endsWith(".yaml"));

      if (yamlFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No ideas found." }],
        };
      }

      const ideas: Array<{
        name: string;
        slug: string;
        status: string;
        problem: string;
        verdict?: string;
        created: string;
      }> = [];

      for (const file of yamlFiles) {
        try {
          const idea = await readYaml<Idea>(join(HIVE_DIRS.ideas, file));
          if (status && idea.status !== status) continue;
          ideas.push({
            name: idea.name,
            slug: idea.slug,
            status: idea.status,
            problem: idea.problem,
            verdict: idea.evaluation?.verdict,
            created: idea.created,
          });
        } catch {
          // Skip malformed files
        }
      }

      if (ideas.length === 0) {
        return {
          content: [{ type: "text" as const, text: status ? `No ideas with status "${status}".` : "No ideas found." }],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(ideas, null, 2),
          },
        ],
      };
    },
  );
}
