import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { FleetCosts, FleetCostEntry, RevenueConfig } from "../types/fleet.js";

interface ProjectPL {
  project: string;
  mrr: number;
  monthly_cost: number;
  net: number;
  customers: number;
  trend: "up" | "down" | "flat";
  profitable: boolean;
}

export function registerFleetRevenue(server: McpServer): void {
  server.tool(
    "hive_fleet_revenue",
    "Fleet-wide P&L dashboard. Shows per-project revenue, costs, and net across all projects.",
    {
      period: z
        .enum(["3m", "6m", "12m", "all"])
        .optional()
        .default("all")
        .describe('Time period to analyze (default: "all")'),
    },
    async ({ period }) => {
      // Read all revenue files
      let revenueFiles: string[];
      try {
        revenueFiles = await readdir(HIVE_DIRS.revenue);
      } catch {
        revenueFiles = [];
      }

      const projectPLs: ProjectPL[] = [];
      let totalMRR = 0;
      let totalCustomers = 0;

      for (const file of revenueFiles.filter((f) => f.endsWith(".yaml"))) {
        try {
          const rev = await readYaml<RevenueConfig>(join(HIVE_DIRS.revenue, file));
          const projectSlug = file.replace(".yaml", "");

          let entries = rev.entries;
          if (period !== "all") {
            const months = parseInt(period.replace("m", ""), 10);
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - months);
            const cutoffStr = cutoff.toISOString().split("T")[0];
            entries = entries.filter((e) => e.date >= cutoffStr);
          }

          const mrr = rev.summary?.mrr ?? 0;
          const customers = rev.summary?.customers ?? 0;
          const trend = rev.summary?.trend ?? "flat";

          totalMRR += mrr;
          totalCustomers += customers;

          projectPLs.push({
            project: projectSlug,
            mrr,
            monthly_cost: 0, // Will be filled from costs
            net: mrr, // Will be adjusted
            customers,
            trend,
            profitable: true, // Will be adjusted
          });
        } catch {
          continue;
        }
      }

      // Read fleet costs
      let totalMonthlyCost = 0;
      try {
        const costsPath = join(HIVE_DIRS.fleet, "costs.yaml");
        const fleetCosts = await readYaml<FleetCosts>(costsPath);

        const normalize = (entry: FleetCostEntry): number =>
          entry.period === "yearly" ? entry.amount / 12 : entry.amount;

        // Assign costs to projects
        for (const entry of fleetCosts.entries) {
          const monthly = normalize(entry);
          totalMonthlyCost += monthly;

          const projects = entry.projects?.length ? entry.projects : [];
          const perProject = projects.length > 0 ? monthly / projects.length : 0;

          for (const proj of projects) {
            const pl = projectPLs.find((p) => p.project === proj);
            if (pl) {
              pl.monthly_cost += perProject;
            }
          }
        }
      } catch {
        // No costs file
      }

      // Finalize P&L calculations
      let profitableCount = 0;
      let unprofitableCount = 0;

      for (const pl of projectPLs) {
        pl.monthly_cost = Math.round(pl.monthly_cost * 100) / 100;
        pl.net = Math.round((pl.mrr - pl.monthly_cost) * 100) / 100;
        pl.profitable = pl.net >= 0;
        if (pl.profitable) profitableCount++;
        else unprofitableCount++;
      }

      // Also include projects with costs but no revenue
      try {
        const projectDirs = await readdir(HIVE_DIRS.projects);
        for (const dir of projectDirs) {
          if (!projectPLs.find((p) => p.project === dir)) {
            // Check if this project has any costs assigned
            // Already handled by fleet costs above — just skip zero-cost projects
          }
        }
      } catch {
        // No projects
      }

      // Sort by net descending
      projectPLs.sort((a, b) => b.net - a.net);

      const totals = {
        total_mrr: Math.round(totalMRR * 100) / 100,
        total_cost: Math.round(totalMonthlyCost * 100) / 100,
        total_net: Math.round((totalMRR - totalMonthlyCost) * 100) / 100,
        total_customers: totalCustomers,
        profitable_projects: profitableCount,
        unprofitable_projects: unprofitableCount,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                period,
                projects: projectPLs,
                totals,
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
