import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { CampaignConfig, CampaignPiece } from "../types/marketing.js";

export function registerDraftCampaign(server: McpServer): void {
  server.tool(
    "hive_draft_campaign",
    "Draft a multi-channel marketing campaign with timeline and content pieces.",
    {
      project: z.string().describe("Project slug"),
      brief: z.string().describe("Campaign brief describing the goal and messaging"),
      channels: z
        .array(z.enum(["email", "twitter", "blog", "landing_page"]))
        .describe("Channels to include in the campaign"),
      duration_days: z.number().optional().default(7).describe("Campaign duration in days (default: 7)"),
    },
    async ({ project, brief, channels, duration_days }) => {
      const archPath = join(HIVE_DIRS.projects, project, "architecture.yaml");

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(archPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      const description = architecture.description || project;
      const componentNames = architecture.components.map((c) => c.name);

      // Generate campaign timeline
      const timeline: CampaignPiece[] = [];

      for (let day = 1; day <= duration_days; day++) {
        for (const channel of channels) {
          // Distribute content across days — not every channel fires every day
          const shouldPost = (() => {
            switch (channel) {
              case "twitter":
                return true; // Daily
              case "email":
                return day === 1 || day === Math.ceil(duration_days / 2) || day === duration_days; // Start, middle, end
              case "blog":
                return day === 1 || day === Math.ceil(duration_days * 0.6); // Launch + mid-campaign
              case "landing_page":
                return day === 1; // Launch day only
              default:
                return false;
            }
          })();

          if (!shouldPost) continue;

          const piece: CampaignPiece = {
            day,
            channel,
            content: generatePieceContent(channel, day, duration_days, project, description, brief, componentNames),
          };

          timeline.push(piece);
        }
      }

      // Generate campaign ID
      const campaignsDir = join(HIVE_DIRS.marketing, project, "campaigns");
      let existingCount = 0;
      try {
        const files = await readdir(campaignsDir);
        existingCount = files.length;
      } catch {
        // Directory doesn't exist yet
      }

      const campaignId = `camp-${String(existingCount + 1).padStart(3, "0")}`;

      const campaign: CampaignConfig = {
        id: campaignId,
        project,
        brief,
        channels,
        duration_days,
        timeline,
        total_pieces: timeline.length,
        estimated_reach: timeline.length * 500, // Rough estimate
        tracking_setup: `Track with UTM parameters:\n- utm_source={channel}\n- utm_medium=campaign\n- utm_campaign=${campaignId}\n- utm_content={piece_id}`,
        status: "draft",
        created: new Date().toISOString().split("T")[0],
      };

      await writeYaml(join(campaignsDir, `${campaignId}.yaml`), campaign);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Campaign "${campaignId}" drafted for "${project}"`,
                campaign_id: campaignId,
                brief,
                channels,
                duration_days,
                total_pieces: timeline.length,
                estimated_reach: campaign.estimated_reach,
                timeline,
                tracking_setup: campaign.tracking_setup,
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

function generatePieceContent(
  channel: string,
  day: number,
  totalDays: number,
  project: string,
  description: string,
  brief: string,
  components: string[],
): string {
  const phase = day === 1 ? "launch" : day === totalDays ? "closing" : "sustain";

  switch (channel) {
    case "twitter": {
      if (phase === "launch") return `Launching ${project}! ${brief}\n\nCheck it out: [link]`;
      if (phase === "closing") return `Last chance! ${project} has been live for ${totalDays} days. Here's what people are saying...\n\n[link]`;
      const component = components[(day - 1) % components.length] ?? project;
      return `Day ${day}: Deep dive into ${component} — one of the key features of ${project}.\n\n${brief}\n\n[link]`;
    }
    case "email": {
      if (phase === "launch")
        return `Subject: ${project} is live!\n\nWe're excited to announce ${project}. ${description}\n\n${brief}\n\nGet started: [link]`;
      if (phase === "closing")
        return `Subject: Don't miss out on ${project}\n\nIt's been ${totalDays} days since we launched. Here's what you might have missed:\n\n${components.map((c) => `- ${c}`).join("\n")}\n\n[link]`;
      return `Subject: Getting the most from ${project}\n\nHere are some tips for using ${project} effectively:\n\n${components.slice(0, 3).map((c) => `- ${c}`).join("\n")}\n\n[link]`;
    }
    case "blog": {
      if (phase === "launch")
        return `# Introducing ${project}\n\n${description}\n\n## Why We Built This\n\n${brief}\n\n## Key Features\n\n${components.map((c) => `- ${c}`).join("\n")}`;
      return `# ${project}: Behind the Architecture\n\nA deep dive into how ${project} is built and the decisions that shaped it.\n\n${components.map((c) => `## ${c}\n\n[Technical details]`).join("\n\n")}`;
    }
    case "landing_page": {
      return `Landing page update for ${project} launch.\n\nHero: ${brief}\nFeatures: ${components.join(", ")}\nCTA: Get Started`;
    }
    default:
      return `${project}: ${brief}`;
  }
}
