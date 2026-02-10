import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { RevenueConfig, RevenueSnapshot, GrowthSignal, GrowthRecommendation } from "../types/fleet.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerGrowthSignals(server: McpServer): void {
  server.tool(
    "hive_growth_signals",
    "Detect growth signals across all products. Classifies products as accelerating, decelerating, or stable with actionable recommendations.",
    {
      threshold: z
        .number()
        .optional()
        .default(5)
        .describe("Minimum growth rate change (%) to flag (default: 5)"),
    },
    async ({ threshold }) => {
      // Read all revenue files
      let revenueFiles: string[];
      try {
        revenueFiles = (await readdir(HIVE_DIRS.revenue)).filter((f) => f.endsWith(".yaml"));
      } catch {
        revenueFiles = [];
      }

      if (revenueFiles.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "No revenue data found. Use hive_track_revenue to log revenue entries." }, null, 2) }],
          isError: true,
        };
      }

      // Also read snapshots for more detailed analysis
      const snapshotsDir = join(HIVE_DIRS.revenue, "snapshots");
      let snapshotFiles: string[] = [];
      try {
        snapshotFiles = (await readdir(snapshotsDir)).filter((f) => f.endsWith(".yaml")).sort();
      } catch {
        // No snapshots
      }

      // Load recent snapshots (last 90 days)
      const cutoff90 = new Date();
      cutoff90.setDate(cutoff90.getDate() - 90);
      const cutoff90Str = cutoff90.toISOString().split("T")[0];

      const recentSnapshots: RevenueSnapshot[] = [];
      for (const file of snapshotFiles) {
        const date = file.replace(".yaml", "");
        if (date >= cutoff90Str) {
          const snap = await safeRead<RevenueSnapshot>(join(snapshotsDir, file));
          if (snap) recentSnapshots.push(snap);
        }
      }

      const signals: GrowthSignal[] = [];

      // Analyze per-project from revenue files
      for (const file of revenueFiles) {
        const projectSlug = file.replace(".yaml", "");
        const rev = await safeRead<RevenueConfig>(join(HIVE_DIRS.revenue, file));
        if (!rev || rev.entries.length < 2) continue;

        const entries = rev.entries.sort((a, b) => a.date.localeCompare(b.date));

        // Compute growth from recent vs older entries
        const mid = Math.floor(entries.length / 2);
        const olderHalf = entries.slice(0, mid);
        const recentHalf = entries.slice(mid);

        const avgOlder = olderHalf.reduce((s, e) => s + e.amount, 0) / olderHalf.length;
        const avgRecent = recentHalf.reduce((s, e) => s + e.amount, 0) / recentHalf.length;

        const growthRate = avgOlder > 0 ? Math.round(((avgRecent - avgOlder) / avgOlder) * 10000) / 100 : 0;

        // Derive signals
        const projectSignals: string[] = [];

        if (growthRate > threshold) {
          projectSignals.push(`Revenue growing ${growthRate}% (period average)`);
        } else if (growthRate < -threshold) {
          projectSignals.push(`Revenue declining ${growthRate}% (period average)`);
        }

        // Check customer growth from entries
        const entriesWithCustomers = entries.filter((e) => e.customers != null);
        if (entriesWithCustomers.length >= 2) {
          const firstCust = entriesWithCustomers[0].customers!;
          const lastCust = entriesWithCustomers[entriesWithCustomers.length - 1].customers!;
          const custGrowth = firstCust > 0 ? Math.round(((lastCust - firstCust) / firstCust) * 10000) / 100 : 0;
          if (custGrowth > threshold) {
            projectSignals.push(`Customer base growing ${custGrowth}%`);
          } else if (custGrowth < -threshold) {
            projectSignals.push(`Customer base shrinking ${custGrowth}%`);
          }
        }

        // Check for recent acceleration/deceleration
        if (entries.length >= 4) {
          const q1 = entries.slice(0, Math.floor(entries.length / 4));
          const q4 = entries.slice(Math.floor(entries.length * 3 / 4));
          const avgQ1 = q1.reduce((s, e) => s + e.amount, 0) / q1.length;
          const avgQ4 = q4.reduce((s, e) => s + e.amount, 0) / q4.length;

          if (avgQ4 > avgRecent && avgQ1 < avgOlder) {
            projectSignals.push("Growth is accelerating (recent quarter faster than average)");
          } else if (avgQ4 < avgRecent && avgQ1 > avgOlder) {
            projectSignals.push("Growth is decelerating (recent quarter slower than average)");
          }
        }

        // Check snapshot data for churn signals
        if (recentSnapshots.length >= 2) {
          const firstSnap = recentSnapshots[0].products?.find((p) => p.project === projectSlug);
          const lastSnap = recentSnapshots[recentSnapshots.length - 1].products?.find((p) => p.project === projectSlug);

          if (firstSnap?.churn_rate != null && lastSnap?.churn_rate != null) {
            if (lastSnap.churn_rate > firstSnap.churn_rate + 2) {
              projectSignals.push(`Churn increasing: ${firstSnap.churn_rate}% → ${lastSnap.churn_rate}%`);
            } else if (lastSnap.churn_rate < firstSnap.churn_rate - 2) {
              projectSignals.push(`Churn decreasing: ${firstSnap.churn_rate}% → ${lastSnap.churn_rate}%`);
            }
          }
        }

        let classification: "accelerating" | "decelerating" | "stable";
        if (growthRate > threshold) classification = "accelerating";
        else if (growthRate < -threshold) classification = "decelerating";
        else classification = "stable";

        signals.push({
          project: projectSlug,
          classification,
          growth_rate: growthRate,
          signals: projectSignals,
        });
      }

      // Sort by growth rate
      const accelerating = signals.filter((s) => s.classification === "accelerating").sort((a, b) => b.growth_rate - a.growth_rate);
      const decelerating = signals.filter((s) => s.classification === "decelerating").sort((a, b) => a.growth_rate - b.growth_rate);
      const stable = signals.filter((s) => s.classification === "stable").sort((a, b) => b.growth_rate - a.growth_rate);

      // Generate recommendations
      const recommendations: GrowthRecommendation[] = [];

      for (const s of accelerating) {
        recommendations.push({
          project: s.project,
          action: "Double down on acquisition channels",
          reasoning: `${s.project} is growing at ${s.growth_rate}%. Invest in what's working — increase marketing spend, add referral incentives.`,
          priority: s.growth_rate > 20 ? "high" : "medium",
        });
      }

      for (const s of decelerating) {
        recommendations.push({
          project: s.project,
          action: "Investigate and address decline",
          reasoning: `${s.project} is declining at ${s.growth_rate}%. Review churn reasons, gather user feedback, check for competitive pressure.`,
          priority: s.growth_rate < -15 ? "high" : "medium",
        });
      }

      for (const s of stable) {
        recommendations.push({
          project: s.project,
          action: "Explore new growth levers",
          reasoning: `${s.project} is stable at ${s.growth_rate}% growth. Consider new features, pricing changes, or new marketing channels to accelerate.`,
          priority: "low",
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                threshold,
                accelerating,
                decelerating,
                stable,
                recommendations,
                summary: {
                  total_products: signals.length,
                  accelerating: accelerating.length,
                  decelerating: decelerating.length,
                  stable: stable.length,
                },
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
