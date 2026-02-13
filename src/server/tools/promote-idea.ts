import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ideasRepo, projectsRepo, slugify } from "../storage/index.js";

export function registerPromoteIdea(server: McpServer): void {
  server.tool(
    "hive_promote_idea",
    "Promote an evaluated idea (verdict: build) into a full project. Creates project with architecture in SQLite.",
    {
      idea: z.string().describe("Idea slug"),
    },
    async ({ idea: slug }) => {
      const ideaData = ideasRepo.getBySlug(slug);
      if (!ideaData) {
        return {
          content: [{ type: "text" as const, text: `Idea "${slug}" not found.` }],
          isError: true,
        };
      }

      const evaluation = ideasRepo.getEvaluation(ideaData.id!);
      if (!evaluation) {
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

      if (evaluation.verdict !== "build") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Idea "${slug}" has verdict "${evaluation.verdict}". Only ideas with verdict "build" can be promoted.`,
            },
          ],
          isError: true,
        };
      }

      const projectSlug = slug;
      const now = new Date().toISOString().split("T")[0];

      const architecture = {
        project: ideaData.name,
        description: ideaData.problem || ideaData.name,
        created: now,
        updated: now,
        status: "planning" as const,
        stack: {},
        components: evaluation.scope.mvp_components.map((c) => ({
          name: slugify(c),
          type: "component",
          description: c,
          files: [],
          dependencies: [],
        })),
        data_flows: [],
        file_structure: {},
      };

      const project = projectsRepo.create({
        slug: projectSlug,
        name: ideaData.name,
        description: ideaData.problem || ideaData.name,
        status: "planning",
        architecture,
      });

      ideasRepo.update(slug, { status: "approved", updated: now });

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
