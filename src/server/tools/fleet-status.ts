import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { HealthConfig, ErrorsConfig, UsageConfig, DeployConfig } from "../types/lifecycle.js";
import type { FleetCosts, RevenueConfig, ProjectStatusCard } from "../types/fleet.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerFleetStatus(server: McpServer): void {
  server.tool(
    "hive_fleet_status",
    "Get a fleet-wide status overview of all projects. Shows health, errors, usage trends, deploy status, costs, and revenue per project.",
    {
      include_archived: z.boolean().optional().default(false).describe("Include archived projects (default: false)"),
    },
    async ({ include_archived }) => {
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      const cards: ProjectStatusCard[] = [];
      let totalCost = 0;
      let totalRevenue = 0;
      let healthyCount = 0;
      let unhealthyCount = 0;

      // Read fleet-level costs
      const fleetCosts = await safeRead<FleetCosts>(join(HIVE_DIRS.fleet, "costs.yaml"));
      const costByProject = new Map<string, number>();
      if (fleetCosts?.entries) {
        for (const entry of fleetCosts.entries) {
          const monthly = entry.period === "yearly" ? entry.amount / 12 : entry.amount;
          if (entry.projects) {
            const perProject = monthly / entry.projects.length;
            for (const p of entry.projects) {
              costByProject.set(p, (costByProject.get(p) ?? 0) + perProject);
            }
          } else {
            // Unassigned cost — counted in total but not per-project
            totalCost += monthly;
          }
        }
      }

      for (const dir of projectDirs) {
        const projDir = join(HIVE_DIRS.projects, dir);
        const arch = await safeRead<Architecture>(join(projDir, "architecture.yaml"));
        if (!arch) continue;
        if (!include_archived && arch.status === "archived") continue;

        // Health
        const healthConfig = await safeRead<HealthConfig>(join(projDir, "health.yaml"));
        let health: "green" | "yellow" | "red" | "unknown" = "unknown";
        if (healthConfig?.results?.length) {
          health = healthConfig.results[healthConfig.results.length - 1].overall;
        }

        // Errors
        const errorsConfig = await safeRead<ErrorsConfig>(join(projDir, "errors.yaml"));
        const recentErrors = errorsConfig?.entries?.filter((e) => !e.resolved).length ?? 0;

        // Usage trend
        const usageConfig = await safeRead<UsageConfig>(join(projDir, "usage.yaml"));
        const usageTrend = usageConfig?.trend?.direction ?? "unknown";

        // Last deploy
        const deployConfig = await safeRead<DeployConfig>(join(projDir, "deploy.yaml"));
        let lastDeploy: string | undefined;
        if (deployConfig?.history?.length) {
          const last = deployConfig.history[deployConfig.history.length - 1];
          lastDeploy = last.date;
        }

        // Revenue
        const revConfig = await safeRead<RevenueConfig>(join(HIVE_DIRS.revenue, `${dir}.yaml`));
        const monthlyRevenue = revConfig?.summary?.mrr ?? 0;

        const monthlyCost = costByProject.get(dir) ?? 0;

        if (health === "green") healthyCount++;
        else if (health === "red") unhealthyCount++;

        totalCost += monthlyCost;
        totalRevenue += monthlyRevenue;

        cards.push({
          project: dir,
          status: arch.status,
          health,
          recent_errors: recentErrors,
          usage_trend: usageTrend as ProjectStatusCard["usage_trend"],
          last_deploy: lastDeploy,
          monthly_cost: Math.round(monthlyCost * 100) / 100,
          monthly_revenue: Math.round(monthlyRevenue * 100) / 100,
        });
      }

      const summary = {
        total_projects: cards.length,
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        total_monthly_cost: Math.round(totalCost * 100) / 100,
        total_monthly_revenue: Math.round(totalRevenue * 100) / 100,
        net_monthly: Math.round((totalRevenue - totalCost) * 100) / 100,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ projects: cards, summary }, null, 2),
          },
        ],
      };
    },
  );
}
