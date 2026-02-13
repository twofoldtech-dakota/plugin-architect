import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { businessRepo } from "../storage/index.js";

export function registerTrackExpense(server: McpServer): void {
  server.tool(
    "hive_track_expense",
    "Track a business expense. Categorized by vendor and type, optionally linked to a project.",
    {
      vendor: z.string().describe("Vendor name (e.g., 'Vercel', 'OpenAI', 'Namecheap')"),
      amount: z.number().describe("Expense amount"),
      category: z
        .enum(["hosting", "apis", "domains", "tools", "hardware", "travel", "other"])
        .describe("Expense category"),
      project: z.string().optional().describe("Project slug this expense is for"),
      recurring: z.boolean().optional().describe("Whether this is a recurring expense"),
      note: z.string().optional().describe("Optional note about the expense"),
    },
    async ({ vendor, amount, category, project, recurring, note }) => {
      const now = new Date();
      const date = now.toISOString();

      const entry = businessRepo.addExpense({
        date,
        vendor,
        amount: Math.round(amount * 100) / 100,
        category,
        project,
        recurring,
        note,
      });

      // Get monthly totals from expenses this month
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monthExpenses = businessRepo.listExpenses(monthStart);
      const monthlyTotal = Math.round(monthExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
      const categoryTotal = Math.round(
        monthExpenses.filter((e) => e.category === category).reduce((sum, e) => sum + e.amount, 0) * 100,
      ) / 100;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: `Expense ${entry.id} logged`,
            entry,
            monthly_total: monthlyTotal,
            category_total: categoryTotal,
          }, null, 2),
        }],
      };
    },
  );
}
