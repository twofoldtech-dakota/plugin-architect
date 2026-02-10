import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { RevenueSnapshot } from "../types/fleet.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerRevenueDashboard(server: McpServer): void {
  server.tool(
    "hive_revenue_dashboard",
    "Revenue dashboard across all products. Shows MRR, ARR, churn, LTV, per-product breakdown, growth signals, and period comparisons.",
    {
      period: z
        .enum(["today", "this_week", "this_month", "this_quarter", "this_year"])
        .optional()
        .default("this_month")
        .describe('Time period to analyze (default: "this_month")'),
      compare_to: z
        .enum(["previous_period", "same_period_last_year"])
        .optional()
        .describe("Compare against a previous period"),
    },
    async ({ period, compare_to }) => {
      const snapshotsDir = join(HIVE_DIRS.revenue, "snapshots");

      let snapshotFiles: string[];
      try {
        snapshotFiles = (await readdir(snapshotsDir)).filter((f) => f.endsWith(".yaml")).sort();
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "No revenue snapshots found.",
                  setup: {
                    message: "Create daily snapshots in ~/.hive/revenue/snapshots/{date}.yaml with this structure:",
                    example: {
                      date: "2025-01-15",
                      total_mrr: 500,
                      total_arr: 6000,
                      total_customers: 25,
                      churn_rate: 2.5,
                      ltv: 240,
                      products: [
                        {
                          project: "my-saas",
                          mrr: 500,
                          customers: 25,
                          churn_rate: 2.5,
                          ltv: 240,
                          plan_breakdown: [
                            { plan: "starter", customers: 15, mrr: 150 },
                            { plan: "pro", customers: 10, mrr: 350 },
                          ],
                        },
                      ],
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      if (snapshotFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "No revenue snapshots found. Add snapshots to ~/.hive/revenue/snapshots/" }, null, 2) }],
          isError: true,
        };
      }

      // Determine date range for the period
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      let periodStart: string;

      switch (period) {
        case "today":
          periodStart = today;
          break;
        case "this_week": {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          periodStart = weekStart.toISOString().split("T")[0];
          break;
        }
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
      }

      // Read snapshots in period
      const periodSnapshots: RevenueSnapshot[] = [];
      for (const file of snapshotFiles) {
        const date = file.replace(".yaml", "");
        if (date >= periodStart && date <= today) {
          const snap = await safeRead<RevenueSnapshot>(join(snapshotsDir, file));
          if (snap) periodSnapshots.push(snap);
        }
      }

      // Get latest snapshot for current totals
      const latest = periodSnapshots.length > 0
        ? periodSnapshots[periodSnapshots.length - 1]
        : await safeRead<RevenueSnapshot>(join(snapshotsDir, snapshotFiles[snapshotFiles.length - 1]));

      if (!latest) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Could not read revenue snapshots." }, null, 2) }],
          isError: true,
        };
      }

      // Compute comparison period if requested
      let comparison: { mrr_change: number; mrr_change_pct: number; customer_change: number } | undefined;
      if (compare_to && periodSnapshots.length > 0) {
        const periodDays = Math.max(1, Math.round((new Date(today).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24)));

        let compStart: string;
        let compEnd: string;

        if (compare_to === "previous_period") {
          const compEndDate = new Date(periodStart);
          compEndDate.setDate(compEndDate.getDate() - 1);
          compEnd = compEndDate.toISOString().split("T")[0];
          const compStartDate = new Date(compEndDate);
          compStartDate.setDate(compStartDate.getDate() - periodDays);
          compStart = compStartDate.toISOString().split("T")[0];
        } else {
          const lastYear = new Date(periodStart);
          lastYear.setFullYear(lastYear.getFullYear() - 1);
          compStart = lastYear.toISOString().split("T")[0];
          const lastYearEnd = new Date(today);
          lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);
          compEnd = lastYearEnd.toISOString().split("T")[0];
        }

        // Find comparison snapshot (last snapshot in comparison period)
        let compSnapshot: RevenueSnapshot | null = null;
        for (const file of [...snapshotFiles].reverse()) {
          const date = file.replace(".yaml", "");
          if (date >= compStart && date <= compEnd) {
            compSnapshot = await safeRead<RevenueSnapshot>(join(snapshotsDir, file));
            if (compSnapshot) break;
          }
        }

        if (compSnapshot) {
          const mrrChange = latest.total_mrr - compSnapshot.total_mrr;
          const mrrChangePct = compSnapshot.total_mrr > 0 ? Math.round((mrrChange / compSnapshot.total_mrr) * 10000) / 100 : 0;
          comparison = {
            mrr_change: Math.round(mrrChange * 100) / 100,
            mrr_change_pct: mrrChangePct,
            customer_change: latest.total_customers - compSnapshot.total_customers,
          };
        }
      }

      // Per-product analysis
      const products = (latest.products ?? []).map((p) => {
        const first = periodSnapshots.length > 1 ? periodSnapshots[0].products?.find((pp) => pp.project === p.project) : undefined;
        const growthRate = first && first.mrr > 0 ? Math.round(((p.mrr - first.mrr) / first.mrr) * 10000) / 100 : 0;
        const contributionPct = latest.total_mrr > 0 ? Math.round((p.mrr / latest.total_mrr) * 10000) / 100 : 0;

        return {
          project: p.project,
          mrr: p.mrr,
          customers: p.customers,
          churn_rate: p.churn_rate,
          ltv: p.ltv,
          growth_rate: growthRate,
          contribution_pct: contributionPct,
          plan_breakdown: p.plan_breakdown,
          trend: growthRate > 5 ? "up" : growthRate < -5 ? "down" : "flat",
        };
      });

      // Identify top growing and needs attention
      const topGrowing = products
        .filter((p) => p.growth_rate > 0)
        .sort((a, b) => b.growth_rate - a.growth_rate)
        .slice(0, 3)
        .map((p) => ({ project: p.project, growth_rate: p.growth_rate }));

      const needsAttention = products
        .filter((p) => p.growth_rate < -5 || (p.churn_rate != null && p.churn_rate > 10))
        .map((p) => ({
          project: p.project,
          reasons: [
            ...(p.growth_rate < -5 ? [`MRR declining: ${p.growth_rate}%`] : []),
            ...(p.churn_rate != null && p.churn_rate > 10 ? [`High churn: ${p.churn_rate}%`] : []),
          ],
        }));

      // Revenue by day for charting
      const revenueByDay = periodSnapshots.map((s) => ({
        date: s.date,
        mrr: s.total_mrr,
        customers: s.total_customers,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                totals: {
                  total_mrr: latest.total_mrr,
                  total_arr: latest.total_arr,
                  total_customers: latest.total_customers,
                  churn_rate: latest.churn_rate,
                  ltv: latest.ltv,
                },
                comparison,
                products,
                top_growing: topGrowing,
                needs_attention: needsAttention,
                revenue_by_day: revenueByDay,
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
