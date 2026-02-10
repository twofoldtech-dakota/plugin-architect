import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { LaunchPlaybook, LaunchAsset } from "../types/marketing.js";

export function registerGenerateLaunch(server: McpServer): void {
  server.tool(
    "hive_generate_launch",
    "Generate launch assets for a project. Creates landing page, README, tweets, Product Hunt listing, email sequences, and changelog from project architecture.",
    {
      project: z.string().describe("Project slug"),
      channels: z
        .array(z.enum(["landing_page", "readme", "tweets", "product_hunt", "email", "changelog"]))
        .optional()
        .describe('Channels to generate (default: all). Options: "landing_page", "readme", "tweets", "product_hunt", "email", "changelog"'),
      tone: z
        .enum(["technical", "casual", "professional"])
        .optional()
        .default("professional")
        .describe('Tone of generated content (default: "professional")'),
    },
    async ({ project, channels, tone }) => {
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

      let decisions: DecisionLog = { decisions: [] };
      try {
        decisions = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, project, "decisions.yaml"));
      } catch {
        // No decisions yet
      }

      const selectedChannels = channels ?? ["landing_page", "readme", "tweets", "product_hunt", "email", "changelog"];
      const componentNames = architecture.components.map((c) => c.name);
      const stackEntries = Object.entries(architecture.stack)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const description = architecture.description || project;
      const assets: LaunchAsset[] = [];

      if (selectedChannels.includes("landing_page")) {
        const sections = architecture.components
          .map((c) => `  <section>\n    <h2>${c.name}</h2>\n    <p>${c.description}</p>\n  </section>`)
          .join("\n");

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project}</title>
  <meta name="description" content="${description}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .hero { padding: 4rem 2rem; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.2rem; opacity: 0.9; max-width: 600px; margin: 0 auto 2rem; }
    .cta { display: inline-block; padding: 0.8rem 2rem; background: white; color: #667eea; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .features { padding: 3rem 2rem; max-width: 900px; margin: 0 auto; }
    section { padding: 1.5rem 0; border-bottom: 1px solid #eee; }
    section h2 { font-size: 1.3rem; margin-bottom: 0.5rem; }
    .stack { padding: 2rem; text-align: center; background: #f8f9fa; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>${project}</h1>
    <p>${description}</p>
    <a href="#" class="cta">Get Started</a>
  </div>
  <div class="features">
${sections}
  </div>
  <div class="stack">
    <p><strong>Built with:</strong> ${stackEntries}</p>
  </div>
</body>
</html>`;

        assets.push({ type: "landing_page", content: html, source_components: componentNames });
      }

      if (selectedChannels.includes("readme")) {
        const featureList = architecture.components.map((c) => `- **${c.name}** — ${c.description}`).join("\n");
        const stackList = Object.entries(architecture.stack)
          .map(([k, v]) => `- **${k}:** ${v}`)
          .join("\n");

        const readme = `# ${project}

${description}

## Features

${featureList}

## Tech Stack

${stackList}

## Getting Started

\`\`\`bash
# Clone the repository
git clone <repo-url>
cd ${project}

# Install dependencies
npm install

# Start development
npm run dev
\`\`\`

## Architecture

${architecture.components.map((c) => `### ${c.name}\n${c.description}\nFiles: ${c.files.join(", ")}`).join("\n\n")}

## License

MIT`;

        assets.push({ type: "readme", content: readme, source_components: componentNames });
      }

      if (selectedChannels.includes("tweets")) {
        const toneEmoji = tone === "casual" ? " 🚀" : "";
        const thread = [
          `Introducing ${project}${toneEmoji}\n\n${description}\n\nA thread on what it does and why I built it 🧵`,
          `The problem:\n\n${decisions.decisions.length > 0 ? decisions.decisions[0].reasoning : `Building ${project} the right way required careful thought about architecture and trade-offs.`}`,
          `How it works:\n\n${architecture.components
            .slice(0, 3)
            .map((c) => `→ ${c.name}: ${c.description}`)
            .join("\n")}`,
          `Built with: ${stackEntries}\n\nKey decisions that shaped the architecture:\n${decisions.decisions
            .slice(0, 3)
            .map((d) => `• ${d.decision}`)
            .join("\n")}`,
          `Try it out: [link]\n\nStar on GitHub: [link]\n\nWould love feedback — what would you build with this?`,
        ];

        assets.push({ type: "tweets", content: thread.join("\n\n---\n\n"), source_components: componentNames });
      }

      if (selectedChannels.includes("product_hunt")) {
        const tagline = description.length > 60 ? description.slice(0, 57) + "..." : description;
        const phDescription = `## What is ${project}?\n\n${description}\n\n## Key Features\n\n${architecture.components.map((c) => `**${c.name}** — ${c.description}`).join("\n\n")}\n\n## Tech Stack\n\n${stackEntries}`;
        const firstComment = `Hey Product Hunt! 👋\n\nI built ${project} because ${decisions.decisions.length > 0 ? decisions.decisions[0].reasoning.toLowerCase() : `I saw an opportunity to solve ${description.toLowerCase()}`}.\n\nThe architecture is built around ${architecture.components.length} core components, using ${stackEntries}.\n\nI'd love to hear your thoughts and feedback!`;
        const makerStory = `The idea for ${project} started when I realized ${decisions.decisions.length > 0 ? decisions.decisions[0].reasoning.toLowerCase() : "there was a gap in the market"}. After ${decisions.decisions.length} architectural decisions and careful planning, it's ready for the world.`;

        const ph = `TAGLINE: ${tagline}\n\nDESCRIPTION:\n${phDescription}\n\nFIRST COMMENT:\n${firstComment}\n\nMAKER STORY:\n${makerStory}`;

        assets.push({ type: "product_hunt", content: ph, source_components: componentNames });
      }

      if (selectedChannels.includes("email")) {
        const emails = [
          `SUBJECT: Welcome to ${project}!\n\nHi there,\n\nThanks for signing up for ${project}. ${description}\n\nHere's how to get started:\n1. Set up your account\n2. Explore the ${architecture.components[0]?.name ?? "main"} feature\n3. Check out the documentation\n\nHave questions? Just reply to this email.\n\nBest,\nThe ${project} team`,
          `SUBJECT: Getting the most out of ${project}\n\nHi there,\n\nNow that you've had a chance to explore ${project}, here are some tips:\n\n${architecture.components
            .slice(0, 3)
            .map((c, i) => `${i + 1}. **${c.name}**: ${c.description}`)
            .join("\n")}\n\nBest,\nThe ${project} team`,
          `SUBJECT: Your ${project} journey so far\n\nHi there,\n\nIt's been a week since you joined ${project}. We'd love to hear how things are going.\n\nHave feedback? Hit reply — we read every message.\n\nBest,\nThe ${project} team`,
        ];

        assets.push({ type: "email", content: emails.join("\n\n===\n\n"), source_components: componentNames });
      }

      if (selectedChannels.includes("changelog")) {
        const features = architecture.components.map((c) => `- ${c.name}: ${c.description}`).join("\n");
        const changelog = `# Changelog\n\n## v1.0.0 — ${new Date().toISOString().split("T")[0]}\n\n### Added\n${features}\n\n### Tech Stack\n${stackEntries}`;

        assets.push({ type: "changelog", content: changelog, source_components: componentNames });
      }

      // Save playbook
      const playbookDir = join(HIVE_DIRS.marketing, project);
      const playbook: LaunchPlaybook = {
        project,
        tone,
        generated: new Date().toISOString(),
        assets,
      };
      await writeYaml(join(playbookDir, "launch-playbook.yaml"), playbook);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Launch assets generated for "${project}"`,
                channels: assets.map((a) => a.type),
                tone,
                saved_to: `marketing/${project}/launch-playbook.yaml`,
                assets,
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
