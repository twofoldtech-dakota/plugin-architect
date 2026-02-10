import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, safeName } from "../storage/index.js";
import type { RevenueConfig, RevenueSnapshot, PricingRecommendation } from "../types/fleet.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerPricingAnalysis(server: McpServer): void {
  server.tool(
    "hive_pricing_analysis",
    "Analyze pricing for a project. Shows current pricing tiers, ARPU, price sensitivity signals, and generates pricing recommendations.",
    {
      project: z.string().describe("Project slug"),
    },
    async ({ project }) => {
      // Read project revenue
      const revenuePath = join(HIVE_DIRS.revenue, `${safeName(project)}.yaml`);
      const revenue = await safeRead<RevenueConfig>(revenuePath);

      if (!revenue || revenue.entries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No revenue data found for "${project}".`,
                  setup: {
                    message: 'Use hive_track_revenue to add revenue entries first, or create revenue snapshots with plan breakdowns.',
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

      // Try to read snapshots for plan breakdown data
      const snapshotsDir = join(HIVE_DIRS.revenue, "snapshots");
      let latestSnapshot: RevenueSnapshot | null = null;
      try {
        const files = (await readdir(snapshotsDir)).filter((f) => f.endsWith(".yaml")).sort();
        if (files.length > 0) {
          latestSnapshot = await safeRead<RevenueSnapshot>(join(snapshotsDir, files[files.length - 1]));
        }
      } catch {
        // No snapshots
      }

      // Extract product data from snapshot
      const productData = latestSnapshot?.products?.find((p) => p.project === project);

      const mrr = revenue.summary?.mrr ?? 0;
      const customers = revenue.summary?.customers ?? 0;
      const arpu = customers > 0 ? Math.round((mrr / customers) * 100) / 100 : 0;

      // Analyze plans if available
      const plans = productData?.plan_breakdown ?? [];
      const planAnalysis = plans.map((p) => ({
        plan: p.plan,
        customers: p.customers,
        mrr: p.mrr,
        arpu: p.customers > 0 ? Math.round((p.mrr / p.customers) * 100) / 100 : 0,
        customer_pct: customers > 0 ? Math.round((p.customers / customers) * 10000) / 100 : 0,
        revenue_pct: mrr > 0 ? Math.round((p.mrr / mrr) * 10000) / 100 : 0,
      }));

      // Price sensitivity signals
      const priceSensitivitySignals: string[] = [];

      // Check for concentration on lowest tier
      if (plans.length >= 2) {
        const sortedByArpu = [...planAnalysis].sort((a, b) => a.arpu - b.arpu);
        const lowestTier = sortedByArpu[0];
        if (lowestTier && lowestTier.customer_pct > 70) {
          priceSensitivitySignals.push(`${lowestTier.customer_pct}% of customers on cheapest plan "${lowestTier.plan}" — may indicate price sensitivity`);
        }

        // Check if top tier has very few customers
        const highestTier = sortedByArpu[sortedByArpu.length - 1];
        if (highestTier && highestTier.customer_pct < 5) {
          priceSensitivitySignals.push(`Only ${highestTier.customer_pct}% on top tier "${highestTier.plan}" — consider reducing gap between tiers`);
        }
      }

      // Check revenue trend
      const trend = revenue.summary?.trend ?? "flat";
      if (trend === "down") {
        priceSensitivitySignals.push("Revenue trending down — avoid price increases, consider adding lower tier");
      }

      // Check churn
      if (productData?.churn_rate != null && productData.churn_rate > 5) {
        priceSensitivitySignals.push(`Churn rate at ${productData.churn_rate}% — review pricing-value alignment before changes`);
      }

      // Generate recommendations
      const recommendations: PricingRecommendation[] = [];

      // If heavy concentration on one plan, suggest adding tiers
      if (plans.length === 1) {
        recommendations.push({
          action: "add_tier",
          target: "premium",
          reasoning: "Only one plan exists. Adding a premium tier can capture willingness-to-pay from power users without changing existing pricing.",
          estimated_impact: {
            mrr_change: Math.round(mrr * 0.15),
            customer_change: 0,
            confidence: "medium",
          },
        });
      }

      // If ARPU is very low relative to any comparable data
      if (plans.length >= 2) {
        const sortedByArpu = [...planAnalysis].sort((a, b) => a.arpu - b.arpu);
        const lowestTier = sortedByArpu[0];
        const highestTier = sortedByArpu[sortedByArpu.length - 1];

        if (lowestTier && lowestTier.customer_pct > 60 && trend !== "down") {
          recommendations.push({
            action: "raise_price",
            target: lowestTier.plan,
            current: lowestTier.arpu,
            proposed: Math.round(lowestTier.arpu * 1.2 * 100) / 100,
            reasoning: `${lowestTier.customer_pct}% of customers are on "${lowestTier.plan}". A modest 20% increase tests price elasticity with limited risk.`,
            estimated_impact: {
              mrr_change: Math.round(lowestTier.mrr * 0.15),
              customer_change: -Math.round(lowestTier.customers * 0.05),
              confidence: "medium",
            },
          });
        }

        if (highestTier && highestTier.customer_pct < 10 && highestTier.arpu > lowestTier.arpu * 5) {
          recommendations.push({
            action: "add_tier",
            target: "mid-tier",
            current: `gap between ${lowestTier.plan} ($${lowestTier.arpu}) and ${highestTier.plan} ($${highestTier.arpu})`,
            proposed: `$${Math.round((lowestTier.arpu + highestTier.arpu) / 2)}`,
            reasoning: "Large price gap between tiers. A mid-tier option can capture customers who want more than basic but find premium too expensive.",
            estimated_impact: {
              mrr_change: Math.round(mrr * 0.1),
              customer_change: Math.round(customers * 0.05),
              confidence: "low",
            },
          });
        }
      }

      // If strong growth, consider price increase
      if (trend === "up" && productData?.churn_rate != null && productData.churn_rate < 3) {
        recommendations.push({
          action: "raise_price",
          target: "all plans",
          reasoning: "Strong growth and low churn suggest room for a price increase. Consider 10-20% across all tiers for new customers.",
          estimated_impact: {
            mrr_change: Math.round(mrr * 0.1),
            customer_change: -Math.round(customers * 0.02),
            confidence: "medium",
          },
        });
      }

      // If no recommendations generated, provide a default
      if (recommendations.length === 0) {
        recommendations.push({
          action: "change_limits",
          target: "feature limits",
          reasoning: "No clear pricing change needed. Consider adjusting feature limits between tiers to encourage upgrades rather than changing prices.",
          estimated_impact: {
            mrr_change: Math.round(mrr * 0.05),
            customer_change: 0,
            confidence: "low",
          },
        });
      }

      // Look for similar products in other projects
      let similarProductsPricing: { project: string; mrr: number; customers: number; arpu: number }[] = [];
      try {
        const revenueFiles = (await readdir(HIVE_DIRS.revenue)).filter((f) => f.endsWith(".yaml") && f !== `${project}.yaml`);
        for (const file of revenueFiles) {
          const rev = await safeRead<RevenueConfig>(join(HIVE_DIRS.revenue, file));
          if (rev && rev.summary && rev.summary.mrr > 0) {
            const slug = file.replace(".yaml", "");
            const otherCustomers = rev.summary.customers ?? 0;
            similarProductsPricing.push({
              project: slug,
              mrr: rev.summary.mrr,
              customers: otherCustomers,
              arpu: otherCustomers > 0 ? Math.round((rev.summary.mrr / otherCustomers) * 100) / 100 : 0,
            });
          }
        }
      } catch {
        // No other revenue files
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                project,
                current_pricing: {
                  mrr,
                  customers,
                  average_revenue_per_user: arpu,
                  trend,
                  churn_rate: productData?.churn_rate,
                  plans: planAnalysis,
                  price_sensitivity_signals: priceSensitivitySignals,
                },
                recommendations,
                similar_products_pricing: similarProductsPricing.length > 0 ? similarProductsPricing : undefined,
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
