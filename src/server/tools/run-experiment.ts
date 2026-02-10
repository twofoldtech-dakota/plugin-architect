import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { ExperimentConfig, ExperimentVariant } from "../types/fleet.js";

export function registerRunExperiment(server: McpServer): void {
  server.tool(
    "hive_run_experiment",
    "Create and track an A/B experiment for a project. Supports pricing, landing page, and feature flag experiments.",
    {
      project: z.string().describe("Project slug"),
      type: z
        .enum(["pricing", "landing_page", "feature_flag"])
        .describe("Experiment type"),
      hypothesis: z.string().describe("What you expect to happen"),
      variants: z
        .array(
          z.object({
            name: z.string().describe("Variant name (e.g., 'control', 'variant_a')"),
            description: z.string().optional().describe("What this variant changes"),
            traffic_pct: z.number().describe("Percentage of traffic for this variant"),
          }),
        )
        .describe("Experiment variants with traffic splits"),
      duration_days: z.number().optional().default(14).describe("How many days to run (default: 14)"),
    },
    async ({ project, type, hypothesis, variants, duration_days }) => {
      // Validate traffic splits sum to 100
      const totalTraffic = variants.reduce((sum, v) => sum + v.traffic_pct, 0);
      if (Math.abs(totalTraffic - 100) > 0.1) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Traffic percentages must sum to 100. Current total: ${totalTraffic}%`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Determine next experiment ID
      const experimentsDir = join(HIVE_DIRS.revenue, "experiments");
      let existingFiles: string[] = [];
      try {
        existingFiles = (await readdir(experimentsDir)).filter((f) => f.endsWith(".yaml"));
      } catch {
        // Directory will be created by writeYaml
      }

      const nextNum = existingFiles.length + 1;
      const experimentId = `exp-${String(nextNum).padStart(3, "0")}`;

      const now = new Date();
      const startDate = now.toISOString().split("T")[0];
      const endDate = new Date(now.getTime() + duration_days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const experimentVariants: ExperimentVariant[] = variants.map((v) => ({
        name: v.name,
        description: v.description,
        traffic_pct: v.traffic_pct,
      }));

      const experiment: ExperimentConfig = {
        id: experimentId,
        project,
        type,
        hypothesis,
        variants: experimentVariants,
        duration_days,
        status: "created",
        started: startDate,
        ends: endDate,
        results: variants.map((v) => ({
          variant: v.name,
          visitors: 0,
          conversions: 0,
          revenue: 0,
          conversion_rate: 0,
        })),
      };

      const experimentPath = join(experimentsDir, `${experimentId}.yaml`);
      await writeYaml(experimentPath, experiment);

      // Generate tracking instructions based on experiment type
      const trackingInstructions: string[] = [];
      switch (type) {
        case "pricing":
          trackingInstructions.push(
            "Implement pricing variants in your payment flow",
            "Track which variant each customer sees via experiment ID",
            "Log conversions (signups/upgrades) per variant",
            "Update experiment results with hive_track_revenue including experiment tags",
          );
          break;
        case "landing_page":
          trackingInstructions.push(
            "Create landing page variants (use A/B testing tool or feature flags)",
            "Assign visitors to variants based on traffic_pct splits",
            "Track page views and conversion events per variant",
            "Update experiment results periodically",
          );
          break;
        case "feature_flag":
          trackingInstructions.push(
            "Implement feature flag with variant assignment logic",
            "Track feature usage and conversion metrics per variant",
            "Monitor for any negative impact on key metrics",
            "Update experiment results periodically",
          );
          break;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Experiment "${experimentId}" created for "${project}"`,
                experiment_id: experimentId,
                status: "created",
                started: startDate,
                ends: endDate,
                duration_days,
                type,
                hypothesis,
                variants: experimentVariants,
                tracking_instructions: trackingInstructions,
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
