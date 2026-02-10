import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Idea, Evaluation } from "../types/idea.js";

export function registerEvaluateIdea(server: McpServer): void {
  registerAppTool(
    server,
    "hive_evaluate_idea",
    {
      description: "Run a structured evaluation against a captured idea to decide if it's worth building",
      _meta: { ui: { resourceUri: "ui://hive/idea-scorecard" } },
      inputSchema: {
        idea: z.string().describe("Idea slug"),
      feasibility: z.object({
        score: z.number().min(1).max(5).describe("Feasibility score 1-5"),
        has_patterns: z.boolean().describe("Do existing patterns apply?"),
        known_stack: z.boolean().describe("Is this a stack you've used before?"),
        estimated_sessions: z.number().describe("Rough build time in coding sessions"),
        unknowns: z.array(z.string()).describe("Things you'd need to figure out"),
      }),
      competitive: z.object({
        exists_already: z.boolean().describe("Does something like this exist?"),
        differentiator: z.string().describe("Why build yours anyway?"),
        references: z.array(z.string()).describe("Known alternatives"),
      }),
      scope: z.object({
        mvp_definition: z.string().describe("The absolute smallest useful version"),
        mvp_components: z.array(z.string()).describe("What's in the MVP"),
        deferred: z.array(z.string()).describe("What's NOT in the MVP"),
        full_vision: z.string().describe("Where this could go"),
      }),
      verdict: z.enum(["build", "park", "kill", "needs_more_thinking"]).describe("Overall verdict"),
        reasoning: z.string().describe("Explanation of the verdict"),
      },
    },
    async ({ idea: slug, feasibility, competitive, scope, verdict, reasoning }) => {
      const filePath = join(HIVE_DIRS.ideas, `${slug}.yaml`);

      let ideaData: Idea;
      try {
        ideaData = await readYaml<Idea>(filePath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Idea "${slug}" not found. Capture it first with hive_capture_idea.` }],
          isError: true,
        };
      }

      const evaluation: Evaluation = {
        feasibility,
        competitive,
        scope,
        verdict,
        reasoning,
      };

      ideaData.evaluation = evaluation;
      ideaData.status = "evaluated";
      ideaData.updated = new Date().toISOString().split("T")[0];

      await writeYaml(filePath, ideaData);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ idea: ideaData.name, slug, evaluation }, null, 2),
          },
        ],
      };
    },
  );
}
