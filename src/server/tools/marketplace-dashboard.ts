import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { PackageManifest, PackageAnalytics } from "../types/marketplace.js";

interface PackageSummary {
  slug: string;
  name: string;
  type: "pattern_bundle" | "stack_bundle";
  price: number | null;
  downloads: number;
  revenue: number;
  average_rating: number;
  trend: "up" | "down" | "flat";
  last_updated: string;
}

export function registerMarketplaceDashboard(server: McpServer): void {
  server.tool(
    "hive_marketplace_dashboard",
    "View marketplace analytics: package downloads, revenue, ratings, and customer insights.",
    {
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .optional()
        .default("all")
        .describe('Analytics period (default: "all")'),
    },
    async ({ period }) => {
      let packageDirs: string[];
      try {
        packageDirs = await readdir(HIVE_DIRS.marketplacePackages);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "No marketplace packages found",
                  totals: { packages: 0, downloads: 0, revenue: 0 },
                  packages: [],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const packages: PackageSummary[] = [];
      let totalDownloads = 0;
      let totalRevenue = 0;
      const allTags: Record<string, number> = {};

      for (const dir of packageDirs) {
        const packageDir = join(HIVE_DIRS.marketplacePackages, dir);

        let manifest: PackageManifest;
        try {
          manifest = await readYaml<PackageManifest>(join(packageDir, "manifest.yaml"));
        } catch {
          continue;
        }

        let analytics: PackageAnalytics;
        try {
          analytics = await readYaml<PackageAnalytics>(join(packageDir, "analytics.yaml"));
        } catch {
          analytics = { slug: dir, downloads: 0, ratings: [], average_rating: 0, revenue: 0 };
        }

        // Filter by period if needed
        if (period !== "all" && analytics.last_download) {
          const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (daysMap[period] ?? 0));
          // Simple period filter — only include if there's activity in the period
          const lastActivity = new Date(analytics.last_download);
          if (lastActivity < cutoff) {
            continue;
          }
        }

        totalDownloads += analytics.downloads;
        totalRevenue += analytics.revenue;

        // Track tag frequency
        try {
          const preview = await readYaml<{ tags?: string[] }>(join(packageDir, "preview.yaml"));
          if (preview.tags) {
            for (const tag of preview.tags) {
              allTags[tag] = (allTags[tag] ?? 0) + 1;
            }
          }
        } catch {
          // No preview file
        }

        // Determine trend (simplified — based on whether downloads are above average)
        const trend: "up" | "down" | "flat" =
          analytics.downloads > 0 && analytics.last_download
            ? "up"
            : analytics.downloads > 0
              ? "flat"
              : "flat";

        packages.push({
          slug: manifest.slug,
          name: manifest.name,
          type: manifest.type,
          price: manifest.pricing.price ?? null,
          downloads: analytics.downloads,
          revenue: analytics.revenue,
          average_rating: analytics.average_rating,
          trend,
          last_updated: manifest.updated,
        });
      }

      // Sort by downloads (top performing first)
      packages.sort((a, b) => b.downloads - a.downloads);

      // Identify packages needing updates
      const needsUpdate = packages
        .filter((p) => {
          const updated = new Date(p.last_updated);
          const daysStale = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
          return daysStale > 90;
        })
        .map((p) => ({
          slug: p.slug,
          name: p.name,
          reason: "Not updated in over 90 days",
        }));

      // Top tags (customer insights)
      const topTags = Object.entries(allTags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

      // Revenue by month (simplified — from total)
      const revenueByMonth: Array<{ month: string; revenue: number }> = [];
      if (totalRevenue > 0) {
        revenueByMonth.push({ month: new Date().toISOString().slice(0, 7), revenue: totalRevenue });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                totals: {
                  packages: packages.length,
                  downloads: totalDownloads,
                  revenue: totalRevenue,
                },
                packages,
                top_performing: packages.slice(0, 5),
                needs_update: needsUpdate,
                revenue_by_month: revenueByMonth,
                customer_insights: {
                  top_tags_requested: topTags,
                  suggested_new_packages:
                    topTags.length > 0
                      ? topTags.slice(0, 3).map((t) => `Package for "${t.tag}" patterns`)
                      : [],
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
