import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { workflowRepo } from "../storage/index.js";

export function registerCaptureWorkflow(server: McpServer): void {
  server.tool(
    "hive_capture_workflow",
    "Log a workflow journal entry — conversation summary, learning, accomplishment, or note. Builds a publishable library over time.",
    {
      type: z.enum(["conversation_summary", "learning", "accomplishment", "note"]).describe("Type of workflow entry"),
      title: z.string().describe("Short headline for the entry"),
      content: z.string().describe("Body text — the full detail"),
      tags: z.array(z.string()).optional().describe("Tags for categorization and search"),
      project: z.string().optional().describe("Project slug this relates to (soft reference)"),
      mood: z.enum(["great", "good", "neutral", "tough"]).optional().describe("How the work felt"),
      publish: z.boolean().optional().default(false).describe("Mark as published immediately (default: false)"),
    },
    async ({ type, title, content, tags, project, mood, publish }) => {
      const now = new Date().toISOString();

      const entry = workflowRepo.create({
        type,
        title,
        content,
        tags: tags ?? [],
        project,
        mood,
        published: publish ?? false,
        published_at: publish ? now : undefined,
        created: now,
        updated: now,
      });

      // Today's summary stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCounts = workflowRepo.countByType(todayStart.toISOString());

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `Workflow entry captured: "${title}"`,
            entry,
            today: todayCounts,
          }, null, 2),
        }],
      };
    },
  );
}
