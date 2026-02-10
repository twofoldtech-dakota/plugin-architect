import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { FleetCosts, FleetCostEntry, RevenueConfig } from "../types/fleet.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerFinancialSummary(server: McpServer): void {
  server.tool(
    "hive_financial_summary",
    "Full financial summary across all projects. Shows revenue breakdown, expenses breakdown, profit, margin, runway, and per-product profitability.",
    {
      period: z
        .enum(["this_month", "this_quarter", "this_year", "all_time"])
        .optional()
        .default("this_month")
        .describe('Time period for summary (default: "this_month")'),
    },
    async ({ period }) => {
      // Determine date range
      const now = new Date();
      let periodStart: string;

      switch (period) {
        case "this_month":
          periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          break;
        case "this_quarter": {
          const qMonth = Math.floor(now.getMonth() / 3) * 3;
          periodStart = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
          break;
        }
        case "this_year":
          periodStart = `${now.getFullYear()}-01-01`;
          break;
        case "all_time":
          periodStart = "1970-01-01";
          break;
      }

      // Read all revenue files
      let revenueFiles: string[];
      try {
        revenueFiles = (await readdir(HIVE_DIRS.revenue)).filter((f) => f.endsWith(".yaml"));
      } catch {
        revenueFiles = [];
      }

      let totalRecurring = 0;
      let totalOneTime = 0;
      let totalCustomers = 0;
      const perProduct: {
        project: string;
        revenue: number;
        recurring: number;
        one_time: number;
        customers: number;
        cost: number;
        profit: number;
        profitable: boolean;
      }[] = [];

      for (const file of revenueFiles) {
        const projectSlug = file.replace(".yaml", "");
        const rev = await safeRead<RevenueConfig>(join(HIVE_DIRS.revenue, file));
        if (!rev) continue;

        // Filter entries by period
        let entries = rev.entries;
        if (period !== "all_time") {
          entries = entries.filter((e) => e.date >= periodStart);
        }

        const projectRevenue = entries.reduce((sum, e) => sum + e.amount, 0);

        // Classify as recurring vs one-time based on model or entry source
        const isRecurring = rev.model === "subscription" || rev.model === "saas" || !rev.model;
        if (isRecurring) {
          totalRecurring += projectRevenue;
        } else {
          totalOneTime += projectRevenue;
        }

        const customers = rev.summary?.customers ?? 0;
        totalCustomers += customers;

        perProduct.push({
          project: projectSlug,
          revenue: Math.round(projectRevenue * 100) / 100,
          recurring: isRecurring ? Math.round(projectRevenue * 100) / 100 : 0,
          one_time: isRecurring ? 0 : Math.round(projectRevenue * 100) / 100,
          customers,
          cost: 0, // Will be filled from costs
          profit: 0, // Will be calculated
          profitable: true, // Will be calculated
        });
      }

      const totalRevenue = totalRecurring + totalOneTime;

      // Read fleet costs
      let expensesByCategory: Record<string, number> = {};
      let totalExpenses = 0;

      try {
        const costsPath = join(HIVE_DIRS.fleet, "costs.yaml");
        const fleetCosts = await readYaml<FleetCosts>(costsPath);

        const normalize = (entry: FleetCostEntry): number =>
          entry.period === "yearly" ? entry.amount / 12 : entry.amount;

        for (const entry of fleetCosts.entries) {
          const monthly = normalize(entry);
          totalExpenses += monthly;

          expensesByCategory[entry.category] = (expensesByCategory[entry.category] ?? 0) + monthly;

          // Assign costs to products
          const projects = entry.projects?.length ? entry.projects : [];
          const perProject = projects.length > 0 ? monthly / projects.length : 0;

          for (const proj of projects) {
            const product = perProduct.find((p) => p.project === proj);
            if (product) {
              product.cost += perProject;
            }
          }
        }
      } catch {
        // No costs file
      }

      // Also read business expenses if they exist
      try {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const expensePath = join(HIVE_DIRS.root, "business", "expenses", String(year), `${month}.yaml`);
        const expenseData = await safeRead<{ entries?: { category: string; amount: number }[] }>(expensePath);
        if (expenseData?.entries) {
          for (const exp of expenseData.entries) {
            const amount = exp.amount ?? 0;
            totalExpenses += amount;
            expensesByCategory[exp.category] = (expensesByCategory[exp.category] ?? 0) + amount;
          }
        }
      } catch {
        // No business expenses
      }

      // Round expense categories
      const expensesBreakdown: Record<string, number> = {};
      for (const [cat, amount] of Object.entries(expensesByCategory)) {
        expensesBreakdown[cat] = Math.round(amount * 100) / 100;
      }
      totalExpenses = Math.round(totalExpenses * 100) / 100;

      // Finalize per-product profitability
      for (const product of perProduct) {
        product.cost = Math.round(product.cost * 100) / 100;
        product.profit = Math.round((product.revenue - product.cost) * 100) / 100;
        product.profitable = product.profit >= 0;
      }

      // Sort by profit descending
      perProduct.sort((a, b) => b.profit - a.profit);

      const profit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
      const marginPct = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

      // Runway: if burning money, how many months at current burn rate
      const monthlyBurn = totalExpenses - totalRevenue;
      const runwayMonths = monthlyBurn > 0 ? undefined : "profitable"; // Would need cash balance for actual runway

      // Identify most and least profitable
      const mostProfitable = perProduct.length > 0 ? perProduct[0] : undefined;
      const leastProfitable = perProduct.length > 0 ? perProduct[perProduct.length - 1] : undefined;

      // Generate recommendations
      const recommendations: string[] = [];

      if (profit < 0) {
        recommendations.push(`Net loss of $${Math.abs(profit)}/month. Focus on reducing costs or increasing revenue.`);
      }

      if (marginPct < 20 && totalRevenue > 0) {
        recommendations.push(`Margin at ${marginPct}% — consider optimizing infrastructure costs or adjusting pricing.`);
      }

      const unprofitable = perProduct.filter((p) => !p.profitable);
      if (unprofitable.length > 0) {
        recommendations.push(`${unprofitable.length} product(s) running at a loss: ${unprofitable.map((p) => p.project).join(", ")}`);
      }

      if (totalOneTime > totalRecurring && totalRecurring > 0) {
        recommendations.push("One-time revenue exceeds recurring. Consider strategies to increase subscription revenue for predictability.");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                revenue: {
                  total: Math.round(totalRevenue * 100) / 100,
                  recurring: Math.round(totalRecurring * 100) / 100,
                  one_time: Math.round(totalOneTime * 100) / 100,
                },
                expenses: {
                  total: totalExpenses,
                  by_category: expensesBreakdown,
                },
                profit,
                margin_pct: marginPct,
                runway: runwayMonths,
                customers: totalCustomers,
                per_product: perProduct,
                most_profitable: mostProfitable ? { project: mostProfitable.project, profit: mostProfitable.profit } : undefined,
                least_profitable: leastProfitable ? { project: leastProfitable.project, profit: leastProfitable.profit } : undefined,
                recommendations,
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
