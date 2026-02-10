import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { FleetCosts, FleetCostEntry, RevenueConfig } from "../types/fleet.js";

interface CostGroup {
  name: string;
  monthly: number;
  yearly: number;
  entries: FleetCostEntry[];
}

export function registerFleetCosts(server: McpServer): void {
  server.tool(
    "hive_fleet_costs",
    "Get a fleet-wide cost breakdown with revenue comparison. Supports grouping by project, category, or provider.",
    {
      group_by: z.enum(["project", "category", "provider"]).optional().default("project").describe('Group costs by dimension (default: "project")'),
    },
    async ({ group_by }) => {
      // Read fleet costs
      const costsPath = join(HIVE_DIRS.fleet, "costs.yaml");
      let fleetCosts: FleetCosts;
      try {
        fleetCosts = await readYaml<FleetCosts>(costsPath);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: "No fleet/costs.yaml found.",
                  setup: {
                    message: "Create ~/.hive/fleet/costs.yaml with this structure:",
                    example: {
                      entries: [
                        { name: "Vercel Pro", category: "hosting", provider: "vercel", amount: 20, period: "monthly", projects: ["my-app"] },
                        { name: "Domain renewal", category: "domains", provider: "namecheap", amount: 12, period: "yearly", projects: ["my-app"] },
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

      // Read all revenue files
      let revenueDirs: string[];
      try {
        revenueDirs = await readdir(HIVE_DIRS.revenue);
      } catch {
        revenueDirs = [];
      }

      const revenueByProject = new Map<string, number>();
      let totalRevenue = 0;

      for (const file of revenueDirs.filter((f) => f.endsWith(".yaml"))) {
        try {
          const rev = await readYaml<RevenueConfig>(join(HIVE_DIRS.revenue, file));
          const projectSlug = file.replace(".yaml", "");
          const mrr = rev.summary?.mrr ?? 0;
          revenueByProject.set(projectSlug, mrr);
          totalRevenue += mrr;
        } catch {
          // Skip unreadable
        }
      }

      // Normalize entries to monthly
      const normalize = (entry: FleetCostEntry): number => (entry.period === "yearly" ? entry.amount / 12 : entry.amount);

      // Group costs
      const groups = new Map<string, CostGroup>();

      for (const entry of fleetCosts.entries) {
        let keys: string[];

        switch (group_by) {
          case "project":
            keys = entry.projects?.length ? entry.projects : ["unassigned"];
            break;
          case "category":
            keys = [entry.category];
            break;
          case "provider":
            keys = [entry.provider];
            break;
        }

        const monthly = normalize(entry);
        // For project grouping, split cost across projects
        const perKey = group_by === "project" && keys.length > 1 ? monthly / keys.length : monthly;

        for (const key of keys) {
          const existing = groups.get(key) ?? { name: key, monthly: 0, yearly: 0, entries: [] };
          existing.monthly += perKey;
          existing.yearly += perKey * 12;
          existing.entries.push(entry);
          groups.set(key, existing);
        }
      }

      const breakdown = Array.from(groups.values()).map((g) => ({
        name: g.name,
        monthly: Math.round(g.monthly * 100) / 100,
        yearly: Math.round(g.yearly * 100) / 100,
        revenue: group_by === "project" ? (revenueByProject.get(g.name) ?? 0) : undefined,
        net: group_by === "project" ? Math.round(((revenueByProject.get(g.name) ?? 0) - g.monthly) * 100) / 100 : undefined,
        entry_count: g.entries.length,
      }));

      // Sort by monthly cost descending
      breakdown.sort((a, b) => b.monthly - a.monthly);

      const totalMonthly = fleetCosts.entries.reduce((sum, e) => sum + normalize(e), 0);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                group_by,
                breakdown,
                totals: {
                  monthly_cost: Math.round(totalMonthly * 100) / 100,
                  yearly_cost: Math.round(totalMonthly * 12 * 100) / 100,
                  monthly_revenue: Math.round(totalRevenue * 100) / 100,
                  yearly_revenue: Math.round(totalRevenue * 12 * 100) / 100,
                  net_monthly: Math.round((totalRevenue - totalMonthly) * 100) / 100,
                  net_yearly: Math.round((totalRevenue - totalMonthly) * 12 * 100) / 100,
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
