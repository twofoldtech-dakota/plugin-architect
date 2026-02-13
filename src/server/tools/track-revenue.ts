import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { businessRepo } from "../storage/index.js";
import type { RevenueEntry } from "../storage/repos/business.js";

function computeRevenueSummary(entries: RevenueEntry[]) {
  if (entries.length === 0) {
    return { mrr: 0, total: 0, customers: 0, trend: "flat" as const };
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const mrr = thisMonthEntries.length > 0
    ? thisMonthEntries.reduce((sum, e) => sum + e.amount, 0)
    : entries.length > 0
      ? entries[entries.length - 1].amount
      : 0;

  const latestWithCustomers = [...entries].reverse().find((e) => e.customers != null);
  const customers = latestWithCustomers?.customers ?? 0;

  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthTotal = entries
    .filter((e) => e.date.startsWith(lastMonthStr))
    .reduce((sum, e) => sum + e.amount, 0);
  const thisMonthTotal = thisMonthEntries.reduce((sum, e) => sum + e.amount, 0);

  let trend: "up" | "down" | "flat" = "flat";
  if (lastMonthTotal > 0) {
    const change = (thisMonthTotal - lastMonthTotal) / lastMonthTotal;
    if (change > 0.05) trend = "up";
    else if (change < -0.05) trend = "down";
  }

  return { mrr: Math.round(mrr * 100) / 100, total: Math.round(total * 100) / 100, customers, trend };
}

export function registerTrackRevenue(server: McpServer): void {
  server.tool(
    "hive_track_revenue",
    'Track revenue for a project. Use action "add" to log a revenue entry, or "query" to view revenue data.',
    {
      project: z.string().describe("Project slug"),
      action: z.enum(["add", "query"]).describe('"add" to log revenue, "query" to view'),
      entry: z
        .object({
          date: z.string().optional().describe("Entry date (YYYY-MM-DD, defaults to today)"),
          amount: z.number().describe("Revenue amount"),
          customers: z.number().optional().describe("Number of customers"),
          source: z.string().optional().describe("Revenue source (e.g., stripe, gumroad)"),
        })
        .optional()
        .describe("Revenue entry (required for add action)"),
      period: z
        .enum(["3m", "6m", "12m", "all"])
        .optional()
        .default("all")
        .describe("Time period for query (default: all)"),
    },
    async ({ project, action, entry, period }) => {
      if (action === "add") {
        if (!entry) {
          return {
            content: [{ type: "text" as const, text: 'An "entry" object with at least an "amount" is required for the "add" action.' }],
            isError: true,
          };
        }

        const newEntry = businessRepo.addRevenue({
          project,
          date: entry.date ?? new Date().toISOString().split("T")[0],
          amount: entry.amount,
          customers: entry.customers,
          source: entry.source,
        });

        const allEntries = businessRepo.listRevenue(project);
        const summary = computeRevenueSummary(allEntries);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ message: `Revenue entry added for "${project}"`, entry: newEntry, summary }, null, 2),
          }],
        };
      }

      // Query action
      let since: string | undefined;
      if (period !== "all") {
        const months = parseInt(period.replace("m", ""), 10);
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        since = cutoff.toISOString().split("T")[0];
      }

      const entries = businessRepo.listRevenue(project, since);
      const summary = computeRevenueSummary(entries);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ project, period, entries, summary }, null, 2),
        }],
      };
    },
  );
}
