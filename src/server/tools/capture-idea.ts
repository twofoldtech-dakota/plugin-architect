import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { slugify, ideasRepo } from "../storage/index.js";

export function registerCaptureIdea(server: McpServer): void {
  server.tool(
    "hive_capture_idea",
    "Capture a raw idea and structure it into an evaluable concept. Saves to SQLite database.",
    {
      description: z.string().describe("Raw brain dump of the idea"),
      name: z.string().optional().describe("Short name for the idea (used as slug). Defaults to first few words of description."),
      problem: z.string().optional().describe("What problem does this solve?"),
      audience: z.string().optional().describe("Who is this for?"),
      proposed_solution: z.string().optional().describe("Proposed solution approach"),
      assumptions: z.array(z.string()).optional().describe("Things that must be true for this to work"),
      open_questions: z.array(z.string()).optional().describe("Things you haven't figured out yet"),
    },
    async ({ description, name, problem, audience, proposed_solution, assumptions, open_questions }) => {
      const shortName = name ?? description.split(/\s+/).slice(0, 8).join(" ");
      const slug = slugify(shortName);
      const now = new Date().toISOString();

      try {
        const idea = ideasRepo.create({
          name: shortName,
          slug,
          description,
          problem: problem ?? "",
          audience: audience ?? "",
          proposed_solution: proposed_solution ?? "",
          assumptions: assumptions ?? [],
          open_questions: open_questions ?? [],
          status: "raw",
          created: now,
          updated: now,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(idea, null, 2),
            },
          ],
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
          return { content: [{ type: "text" as const, text: `An idea with slug "${slug}" already exists.` }], isError: true };
        }
        throw err;
      }
    },
  );
}
