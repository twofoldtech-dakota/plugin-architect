import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { businessRepo } from "../storage/index.js";

function getDateRange(period: string, start?: string, end?: string): { from: string; to: string } {
  const now = new Date();

  if (start && end) return { from: start, to: end };

  switch (period) {
    case "this_quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return {
        from: `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`,
        to: now.toISOString().split("T")[0],
      };
    }
    case "this_year":
      return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split("T")[0] };
    case "last_year":
      return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
    case "custom":
      return { from: start ?? "1970-01-01", to: end ?? now.toISOString().split("T")[0] };
    default:
      return { from: `${now.getFullYear()}-01-01`, to: now.toISOString().split("T")[0] };
  }
}

export function registerFinancialReport(server: McpServer): void {
  server.tool(
    "hive_financial_report",
    "Generate a financial report with revenue breakdown, expenses breakdown, profit, tax estimates, and outstanding invoices.",
    {
      period: z
        .enum(["this_quarter", "this_year", "last_year", "custom"])
        .optional()
        .default("this_quarter")
        .describe("Report period"),
      start: z.string().optional().describe("Custom start date (ISO format)"),
      end: z.string().optional().describe("Custom end date (ISO format)"),
      format: z
        .enum(["summary", "detailed", "tax_ready"])
        .optional()
        .default("summary")
        .describe("Report format"),
    },
    async ({ period, start, end, format }) => {
      const range = getDateRange(period, start, end);

      // ---- Revenue ----
      const allRevenue = businessRepo.listRevenue(undefined, range.from);
      const filteredRevenue = allRevenue.filter((e) => e.date >= range.from && e.date <= range.to);

      let totalRevenue = 0;
      const revenueByProject: Record<string, number> = {};
      const revenueByMonth: Record<string, number> = {};

      for (const entry of filteredRevenue) {
        totalRevenue += entry.amount;
        revenueByProject[entry.project] = (revenueByProject[entry.project] ?? 0) + entry.amount;
        const month = entry.date.slice(0, 7);
        revenueByMonth[month] = (revenueByMonth[month] ?? 0) + entry.amount;
      }

      // Round revenue values
      for (const key of Object.keys(revenueByProject)) {
        revenueByProject[key] = Math.round(revenueByProject[key] * 100) / 100;
      }
      for (const key of Object.keys(revenueByMonth)) {
        revenueByMonth[key] = Math.round(revenueByMonth[key] * 100) / 100;
      }
      totalRevenue = Math.round(totalRevenue * 100) / 100;

      // ---- Expenses ----
      const allExpenses = businessRepo.listExpenses(range.from);
      const filteredExpenses = allExpenses.filter((e) => e.date >= range.from && e.date <= range.to);

      let totalExpenses = 0;
      const expensesByCategory: Record<string, number> = {};
      const expensesByVendor: Record<string, number> = {};
      const expensesByMonth: Record<string, number> = {};

      for (const e of filteredExpenses) {
        totalExpenses += e.amount;
        expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
        expensesByVendor[e.vendor] = (expensesByVendor[e.vendor] ?? 0) + e.amount;
        const month = e.date.slice(0, 7);
        expensesByMonth[month] = (expensesByMonth[month] ?? 0) + e.amount;
      }

      // Round expense values
      for (const key of Object.keys(expensesByCategory)) {
        expensesByCategory[key] = Math.round(expensesByCategory[key] * 100) / 100;
      }
      for (const key of Object.keys(expensesByVendor)) {
        expensesByVendor[key] = Math.round(expensesByVendor[key] * 100) / 100;
      }
      for (const key of Object.keys(expensesByMonth)) {
        expensesByMonth[key] = Math.round(expensesByMonth[key] * 100) / 100;
      }
      totalExpenses = Math.round(totalExpenses * 100) / 100;

      // ---- Profit ----
      const profit = Math.round((totalRevenue - totalExpenses) * 100) / 100;
      const marginPct = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

      // ---- Outstanding Invoices ----
      let unpaidCount = 0;
      let amountOutstanding = 0;
      const overdueInvoices: { id: string; client: string; amount: number; due_date?: string }[] = [];

      const allInvoices = businessRepo.listInvoices();
      const today = new Date().toISOString().split("T")[0];
      for (const inv of allInvoices) {
        if (inv.status === "sent" || inv.status === "overdue") {
          unpaidCount++;
          amountOutstanding += inv.total;
          if (inv.due_date && inv.due_date < today) {
            overdueInvoices.push({ id: inv.id!, client: inv.client_id, amount: inv.total, due_date: inv.due_date });
          }
        }
      }
      amountOutstanding = Math.round(amountOutstanding * 100) / 100;

      // ---- Tax Estimates ----
      let taxEstimates: Record<string, unknown> | undefined;
      if (format === "tax_ready") {
        const deductible = totalExpenses;
        const taxableIncome = Math.max(0, totalRevenue - deductible);
        const estimatedRate = 0.25;
        const estimatedLiability = Math.round(taxableIncome * estimatedRate * 100) / 100;
        const quarterlyPayment = Math.round(estimatedLiability / 4 * 100) / 100;

        taxEstimates = {
          estimated_liability: estimatedLiability,
          quarterly_payment_due: quarterlyPayment,
          deductible_expenses: Math.round(deductible * 100) / 100,
          taxable_income: Math.round(taxableIncome * 100) / 100,
          notes: [
            "Estimates only — consult a tax professional.",
            "All business expenses treated as deductible.",
            "Using simplified 25% effective tax rate.",
          ],
        };
      }

      // ---- Profit by Month ----
      const profitByMonth: Record<string, number> = {};
      const allMonths = new Set([...Object.keys(revenueByMonth), ...Object.keys(expensesByMonth)]);
      for (const month of allMonths) {
        profitByMonth[month] = Math.round(((revenueByMonth[month] ?? 0) - (expensesByMonth[month] ?? 0)) * 100) / 100;
      }

      const result: Record<string, unknown> = {
        period,
        range,
        revenue: {
          total: totalRevenue,
          by_project: revenueByProject,
        },
        expenses: {
          total: totalExpenses,
          by_category: expensesByCategory,
        },
        profit: { net: profit, margin_pct: marginPct },
        outstanding: {
          unpaid_invoices: unpaidCount,
          amount_outstanding: amountOutstanding,
          overdue: overdueInvoices,
        },
      };

      if (format === "detailed" || format === "tax_ready") {
        result.revenue_by_month = revenueByMonth;
        result.expenses_by_month = expensesByMonth;
        result.expenses_by_vendor = expensesByVendor;
        result.profit_by_month = profitByMonth;
      }

      if (taxEstimates) {
        result.tax_estimates = taxEstimates;
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
