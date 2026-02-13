import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { workflowRepo } from "../storage/index.js";
import type { WorkflowEntry, WorkflowJsonFeed, WorkflowFeedItem } from "../types/workflow.js";

function periodToSince(period: string): string | undefined {
  const now = new Date();
  switch (period) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "this_week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    }
    default:
      return undefined;
  }
}

function toJsonFeed(entries: WorkflowEntry[], title: string, feedUrl?: string, homeUrl?: string): WorkflowJsonFeed {
  const items: WorkflowFeedItem[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    content_text: e.content,
    date_published: e.published_at ?? e.created,
    date_modified: e.updated,
    tags: e.tags.length > 0 ? e.tags : undefined,
    _hive: {
      type: e.type,
      project: e.project,
      mood: e.mood,
    },
  }));

  return {
    version: "https://jsonfeed.org/version/1.1",
    title,
    home_page_url: homeUrl,
    feed_url: feedUrl,
    items,
  };
}

function toMarkdown(entries: WorkflowEntry[], title: string): string {
  const lines: string[] = [`# ${title}`, ""];

  for (const e of entries) {
    const date = new Date(e.created).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    lines.push(`## ${e.title}`);
    lines.push("");
    lines.push(`**${e.type.replace(/_/g, " ")}** | ${date}${e.project ? ` | ${e.project}` : ""}${e.mood ? ` | mood: ${e.mood}` : ""}`);
    lines.push("");
    lines.push(e.content);
    lines.push("");
    if (e.tags.length > 0) {
      lines.push(`Tags: ${e.tags.map((t) => `\`${t}\``).join(", ")}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function registerExportWorkflow(server: McpServer): void {
  server.tool(
    "hive_export_workflow",
    "Export workflow journal entries as JSON Feed v1.1 or Markdown. Default: only published entries.",
    {
      format: z.enum(["json_feed", "markdown"]).describe("Export format"),
      type: z.enum(["conversation_summary", "learning", "accomplishment", "note"]).optional().describe("Filter by entry type"),
      tag: z.string().optional().describe("Filter by tag"),
      period: z.enum(["today", "this_week", "this_month", "all"]).optional().default("all").describe("Time period filter"),
      include_unpublished: z.boolean().optional().default(false).describe("Include unpublished entries (default: false)"),
      feed_title: z.string().optional().default("Workflow Journal").describe("Feed/document title"),
      feed_url: z.string().optional().describe("JSON Feed self URL"),
      home_url: z.string().optional().describe("Home page URL for the feed"),
    },
    async ({ format, type, tag, period, include_unpublished, feed_title, feed_url, home_url }) => {
      const since = periodToSince(period ?? "all");

      const entries = workflowRepo.list({
        type,
        tag,
        since,
        published: include_unpublished ? undefined : true,
      });

      const title = feed_title ?? "Workflow Journal";

      if (entries.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: `No ${include_unpublished ? "" : "published "}workflow entries found for the given filters.`,
          }],
        };
      }

      if (format === "json_feed") {
        const feed = toJsonFeed(entries, title, feed_url, home_url);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(feed, null, 2),
          }],
        };
      }

      // Markdown
      const md = toMarkdown(entries, title);
      return {
        content: [{
          type: "text" as const,
          text: md,
        }],
      };
    },
  );
}
