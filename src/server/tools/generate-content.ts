import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { ContentPiece } from "../types/marketing.js";

export function registerGenerateContent(server: McpServer): void {
  server.tool(
    "hive_generate_content",
    "Generate content for a project. Supports blog posts, tutorials, documentation, comparisons, and case studies.",
    {
      project: z.string().describe("Project slug"),
      type: z
        .enum(["blog_post", "tutorial", "documentation", "comparison", "case_study"])
        .describe("Content type to generate"),
      topic: z.string().optional().describe("Specific topic or angle for the content"),
      target_keywords: z.array(z.string()).optional().describe("Target SEO keywords"),
    },
    async ({ project, type, topic, target_keywords }) => {
      const archPath = join(HIVE_DIRS.projects, safeName(project), "architecture.yaml");

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
        decisions = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, safeName(project), "decisions.yaml"));
      } catch {
        // No decisions
      }

      const description = architecture.description || project;
      const stackEntries = Object.entries(architecture.stack)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const effectiveTopic = topic || `Building ${project} with ${stackEntries}`;
      const keywords = target_keywords ?? Object.keys(architecture.stack);

      let title = "";
      let body = "";
      const codeExamples: ContentPiece["code_examples"] = [];

      switch (type) {
        case "blog_post": {
          title = `Introducing ${project}: ${effectiveTopic}`;
          body = `# ${title}\n\n${description}\n\n## The Problem\n\n${
            decisions.decisions.length > 0
              ? decisions.decisions[0].reasoning
              : `Building modern software requires thoughtful architecture decisions. ${project} addresses this by providing a well-structured solution.`
          }\n\n## The Solution\n\n${project} is built around ${architecture.components.length} core components:\n\n${architecture.components
            .map((c) => `### ${c.name}\n\n${c.description}\n\n**Key files:** ${c.files.join(", ")}`)
            .join("\n\n")}\n\n## Architecture Decisions\n\n${
            decisions.decisions.length > 0
              ? decisions.decisions
                  .slice(0, 5)
                  .map((d) => `- **${d.decision}** — ${d.reasoning}`)
                  .join("\n")
              : "Architecture decisions are documented as the project evolves."
          }\n\n## Tech Stack\n\n${stackEntries}\n\n## What's Next\n\nWe're continuing to develop ${project} with a focus on stability and developer experience. Stay tuned for updates.`;
          break;
        }

        case "tutorial": {
          title = `Getting Started with ${project}: ${effectiveTopic}`;
          const steps = architecture.components.map(
            (c, i) =>
              `### Step ${i + 1}: Set up ${c.name}\n\n${c.description}\n\n\`\`\`\n// ${c.files[0] ?? `${c.name}.ts`}\n// Configure ${c.name}\n\`\`\``,
          );
          body = `# ${title}\n\nThis tutorial walks you through setting up and using ${project}.\n\n## Prerequisites\n\n- Node.js 18+\n- ${stackEntries}\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n${steps.join("\n\n")}\n\n## Summary\n\nYou now have ${project} set up with ${architecture.components.length} components working together.`;

          for (const c of architecture.components.slice(0, 3)) {
            codeExamples.push({
              code: `// ${c.name} setup\n// See: ${c.files[0] ?? `${c.name}.ts`}`,
              language: "typescript",
              source_file: c.files[0],
            });
          }
          break;
        }

        case "documentation": {
          title = `${project} Documentation`;
          const componentDocs = architecture.components
            .map(
              (c) =>
                `## ${c.name}\n\n**Type:** ${c.type}\n**Description:** ${c.description}\n**Files:** ${c.files.join(", ")}\n**Dependencies:** ${c.dependencies.length > 0 ? c.dependencies.join(", ") : "None"}`,
            )
            .join("\n\n---\n\n");

          const dataFlowDocs =
            architecture.data_flows.length > 0
              ? `## Data Flows\n\n${architecture.data_flows.map((f) => `### ${f.name}\n\n${f.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`).join("\n\n")}`
              : "";

          body = `# ${title}\n\n${description}\n\n## Overview\n\n**Status:** ${architecture.status}\n**Stack:** ${stackEntries}\n**Components:** ${architecture.components.length}\n\n${componentDocs}\n\n${dataFlowDocs}\n\n## Decisions Log\n\n${
            decisions.decisions.length > 0
              ? decisions.decisions.map((d) => `- **[${d.id}] ${d.component}:** ${d.decision} — ${d.reasoning}`).join("\n")
              : "No decisions logged yet."
          }`;
          break;
        }

        case "comparison": {
          title = `${project} vs Alternatives: ${effectiveTopic}`;
          body = `# ${title}\n\n## What is ${project}?\n\n${description}\n\n## Key Differentiators\n\n${architecture.components
            .map((c) => `- **${c.name}**: ${c.description}`)
            .join("\n")}\n\n## Architecture Approach\n\n${project} uses ${stackEntries}, making specific trade-offs:\n\n${
            decisions.decisions.length > 0
              ? decisions.decisions
                  .filter((d) => d.alternatives_considered && d.alternatives_considered.length > 0)
                  .slice(0, 5)
                  .map(
                    (d) =>
                      `### ${d.component}\n**Chose:** ${d.decision}\n**Over:** ${d.alternatives_considered?.join(", ")}\n**Why:** ${d.reasoning}`,
                  )
                  .join("\n\n")
              : "Detailed comparison points are documented through architectural decisions."
          }\n\n## Summary\n\n${project} is best suited for teams that need ${description.toLowerCase()}.`;
          break;
        }

        case "case_study": {
          title = `Case Study: Building ${project}`;
          const timelineEntries = decisions.decisions
            .slice(0, 10)
            .map((d) => `- **${d.date}** — ${d.decision} (${d.component})`)
            .join("\n");

          body = `# ${title}\n\n## Overview\n\n${description}\n\n## Challenge\n\n${
            decisions.decisions.length > 0
              ? decisions.decisions[0].reasoning
              : `The goal was to build a solution for ${description.toLowerCase()}.`
          }\n\n## Solution Architecture\n\n**Stack:** ${stackEntries}\n\n**Components:**\n${architecture.components
            .map((c) => `- ${c.name} (${c.type}): ${c.description}`)
            .join("\n")}\n\n## Decision Timeline\n\n${timelineEntries || "Decisions are being tracked as the project progresses."}\n\n## Results\n\n- ${architecture.components.length} components built\n- ${decisions.decisions.length} architectural decisions documented\n- Stack: ${stackEntries}\n\n## Lessons Learned\n\n${
            decisions.decisions
              .filter((d) => d.alternatives_considered && d.alternatives_considered.length > 0)
              .slice(0, 3)
              .map((d) => `- Chose ${d.decision} over ${d.alternatives_considered?.join(", ")} — ${d.reasoning}`)
              .join("\n") || "Key lessons are captured in architectural decisions."
          }`;
          break;
        }
      }

      const wordCount = body.split(/\s+/).length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));

      // Generate content ID
      const contentDir = join(HIVE_DIRS.marketing, safeName(project));
      let existingCount = 0;
      try {
        const files = await readdir(contentDir);
        existingCount = files.filter((f) => f.startsWith("content-")).length;
      } catch {
        // Directory doesn't exist yet
      }

      const contentId = `content-${String(existingCount + 1).padStart(3, "0")}`;

      const piece: ContentPiece = {
        id: contentId,
        project,
        type,
        title,
        body,
        meta: {
          description: description.slice(0, 160),
          keywords,
          word_count: wordCount,
          reading_time_min: readingTime,
        },
        code_examples: codeExamples.length > 0 ? codeExamples : undefined,
        internal_links: architecture.components.flatMap((c) => c.files).slice(0, 5),
        suggested_publish_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        created: new Date().toISOString().split("T")[0],
      };

      await writeYaml(join(contentDir, `${contentId}.yaml`), piece);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `${type} generated for "${project}"`,
                content: piece,
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
