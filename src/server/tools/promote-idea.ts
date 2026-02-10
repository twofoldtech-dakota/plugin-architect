import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Idea } from "../types/idea.js";

export function registerPromoteIdea(server: McpServer): void {
  server.tool(
    "hive_promote_idea",
    "Promote an evaluated idea (verdict: build) into a full project. Creates project directory with architecture, decisions, and API docs.",
    {
      idea: z.string().describe("Idea slug"),
    },
    async ({ idea: slug }) => {
      const filePath = join(HIVE_DIRS.ideas, `${slug}.yaml`);

      let ideaData: Idea;
      try {
        ideaData = await readYaml<Idea>(filePath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Idea "${slug}" not found.` }],
          isError: true,
        };
      }

      if (!ideaData.evaluation) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Idea "${slug}" has not been evaluated yet. Run hive_evaluate_idea first.`,
            },
          ],
          isError: true,
        };
      }

      if (ideaData.evaluation.verdict !== "build") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Idea "${slug}" has verdict "${ideaData.evaluation.verdict}". Only ideas with verdict "build" can be promoted.`,
            },
          ],
          isError: true,
        };
      }

      // Initialize project from idea's MVP scope
      const projectSlug = slug;
      const now = new Date().toISOString().split("T")[0];
      const projectDir = join(HIVE_DIRS.projects, projectSlug);

      const architecture = {
        project: ideaData.name,
        description: ideaData.problem || ideaData.name,
        created: now,
        updated: now,
        status: "planning",
        stack: {},
        components: ideaData.evaluation.scope.mvp_components.map((c) => ({
          name: slugify(c),
          type: "component",
          description: c,
          files: [],
          dependencies: [],
        })),
        data_flows: [],
        file_structure: {},
      };

      await writeYaml(join(projectDir, "architecture.yaml"), architecture);
      await writeYaml(join(projectDir, "decisions.yaml"), { decisions: [] });
      await writeYaml(join(projectDir, "apis.yaml"), { apis: [] });

      // Update idea status
      ideaData.status = "approved";
      ideaData.updated = now;
      await writeYaml(filePath, ideaData);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Idea "${ideaData.name}" promoted to project "${projectSlug}"`,
                project: projectSlug,
                architecture,
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
