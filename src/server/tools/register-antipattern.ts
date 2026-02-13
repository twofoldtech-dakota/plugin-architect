import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { slugify, antipatternsRepo } from "../storage/index.js";

export function registerRegisterAntipattern(server: McpServer): void {
  server.tool(
    "hive_register_antipattern",
    "Register an anti-pattern — something you learned NOT to do.",
    {
      name: z.string().describe("Short name for the anti-pattern"),
      description: z.string().describe("What the anti-pattern is"),
      context: z.string().describe("When/where this comes up"),
      why_bad: z.string().describe("Why this is a bad idea"),
      instead: z.string().describe("What to do instead"),
      tags: z.array(z.string()).describe("Tags for discovery"),
      severity: z.enum(["critical", "warning", "minor"]).describe("How bad is this?"),
      learned_from: z.string().optional().describe("Project slug where this was learned"),
    },
    async ({ name, description, context, why_bad, instead, tags, severity, learned_from }) => {
      const slug = slugify(name);
      const now = new Date().toISOString();

      try {
        antipatternsRepo.create({ name, slug, description, context, why_bad, instead, tags, severity, learned_from, created: now });

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: `Anti-pattern "${name}" registered`, slug, severity, tags }, null, 2) }],
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
          return { content: [{ type: "text" as const, text: `An anti-pattern with slug "${slug}" already exists.` }], isError: true };
        }
        throw err;
      }
    },
  );
}
