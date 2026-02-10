import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, writeYaml, slugify } from "../storage/index.js";
import type { Idea } from "../types/idea.js";

export function registerCaptureIdea(server: McpServer): void {
  server.tool(
    "hive_capture_idea",
    "Capture a raw idea and structure it into an evaluable concept. Saves to ~/.hive/ideas/{slug}.yaml",
    {
      description: z.string().describe("Raw brain dump of the idea"),
      problem: z.string().optional().describe("What problem does this solve?"),
      audience: z.string().optional().describe("Who is this for?"),
      proposed_solution: z.string().optional().describe("Proposed solution approach"),
      assumptions: z.array(z.string()).optional().describe("Things that must be true for this to work"),
      open_questions: z.array(z.string()).optional().describe("Things you haven't figured out yet"),
    },
    async ({ description, problem, audience, proposed_solution, assumptions, open_questions }) => {
      const slug = slugify(description);
      const now = new Date().toISOString().split("T")[0];

      const idea: Idea = {
        name: description,
        slug,
        problem: problem ?? "",
        audience: audience ?? "",
        proposed_solution: proposed_solution ?? "",
        assumptions: assumptions ?? [],
        open_questions: open_questions ?? [],
        status: "raw",
        created: now,
        updated: now,
      };

      const filePath = join(HIVE_DIRS.ideas, `${slug}.yaml`);
      await writeYaml(filePath, idea);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(idea, null, 2),
          },
        ],
      };
    },
  );
}
