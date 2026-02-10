import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { ExpenseEntry, MonthlyExpenses } from "../types/business.js";

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
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const date = now.toISOString().split("T")[0];

      const expensePath = join(HIVE_DIRS.businessExpenses, year, `${month}.yaml`);

      let config: MonthlyExpenses;
      try {
        config = await readYaml<MonthlyExpenses>(expensePath);
      } catch {
        config = {
          month: `${year}-${month}`,
          entries: [],
          totals: { total: 0, by_category: {} },
        };
      }

      const entryId = `exp-${year}${month}-${String(config.entries.length + 1).padStart(3, "0")}`;

      const entry: ExpenseEntry = {
        id: entryId,
        date,
        vendor,
        amount: Math.round(amount * 100) / 100,
        category,
        project,
        recurring,
        note,
      };

      config.entries.push(entry);

      // Recompute totals
      config.totals.total = Math.round(config.entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
      config.totals.by_category = {};
      for (const e of config.entries) {
        config.totals.by_category[e.category] = Math.round(((config.totals.by_category[e.category] ?? 0) + e.amount) * 100) / 100;
      }

      await writeYaml(expensePath, config);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Expense ${entryId} logged`,
                entry,
                monthly_total: config.totals.total,
                category_total: config.totals.by_category[category],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
