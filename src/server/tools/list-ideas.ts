import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { ideasRepo } from "../storage/index.js";

export function registerListIdeas(server: McpServer): void {
  registerAppTool(
    server,
    "hive_list_ideas",
    {
      description: "List all captured ideas with their status and verdict",
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: "ui://hive/idea-kanban" } },
      inputSchema: {
        status: z
          .enum(["raw", "evaluated", "approved", "rejected", "parked"])
          .optional()
          .describe("Filter by status"),
      },
    },
    async ({ status }) => {
      const ideas = ideasRepo.list(status);

      if (ideas.length === 0) {
        return {
          content: [{ type: "text" as const, text: status ? `No ideas with status "${status}".` : "No ideas found." }],
        };
      }

      const ideaIds = ideas.map((i) => i.id!);
      const evaluations = ideasRepo.getEvaluationsByIdeaIds(ideaIds);

      const summaries = ideas.map((idea) => {
        const evaluation = evaluations.get(idea.id!);
        return {
          name: idea.name,
          slug: idea.slug,
          status: idea.status,
          problem: idea.problem,
          audience: idea.audience,
          verdict: evaluation?.verdict,
          feasibility_score: evaluation?.feasibility?.score,
          estimated_sessions: evaluation?.feasibility?.estimated_sessions,
          created: idea.created,
        };
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summaries, null, 2),
          },
        ],
      };
    },
  );
}
