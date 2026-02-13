import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { slugify, ideasRepo, projectsRepo } from "../storage/index.js";

export function registerBuildFromDescription(server: McpServer): void {
  server.tool(
    "hive_build_from_description",
    "End-to-end build pipeline: takes a natural language description and orchestrates idea capture, evaluation, project creation, build planning, and execution.",
    {
      description: z.string().describe("Natural language description of what to build"),
      auto_approve: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, proceed through all steps without pausing for approval (default: false)"),
    },
    async ({ description, auto_approve }) => {
      const now = new Date().toISOString().split("T")[0];
      const slug = slugify(description.slice(0, 60));

      // Step 1: Capture idea
      const idea = ideasRepo.create({
        name: description.split(/\s+/).slice(0, 8).join(" "),
        slug,
        description,
        problem: description,
        audience: "developer",
        proposed_solution: description,
        assumptions: [],
        open_questions: [],
        status: "raw",
        created: now,
        updated: now,
      });

      if (!auto_approve) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              pipeline_status: "awaiting_approval",
              current_step: "capture_idea",
              completed_step: "Idea captured",
              idea_slug: slug,
              idea,
              next_step: "evaluate_idea",
              instructions: 'Idea has been captured. To continue the pipeline, run hive_evaluate_idea to evaluate it, then hive_promote_idea to create the project, then hive_plan_build to generate a build plan, then hive_execute_step to start building.',
            }, null, 2),
          }],
        };
      }

      // Auto-approve mode: evaluate and promote
      ideasRepo.createEvaluation(idea.id!, {
        feasibility: {
          score: 3,
          has_patterns: false,
          known_stack: true,
          estimated_sessions: 5,
          unknowns: ["Auto-evaluated — review before building"],
        },
        competitive: {
          exists_already: false,
          differentiator: "Custom-built to exact requirements",
          references: [],
        },
        scope: {
          mvp_definition: description,
          mvp_components: ["core"],
          deferred: [],
          full_vision: description,
        },
        verdict: "build",
        reasoning: "Auto-approved via build_from_description pipeline.",
      });

      ideasRepo.update(slug, { status: "approved", updated: now });

      // Create project
      const project = projectsRepo.create({
        slug,
        name: slug,
        description,
        status: "planning",
        architecture: {
          project: slug,
          description,
          created: now,
          updated: now,
          status: "planning",
          stack: {},
          components: [
            {
              name: "core",
              type: "module",
              description: "Core application logic",
              files: [],
              dependencies: [],
            },
          ],
          data_flows: [],
          file_structure: {},
        },
      });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            pipeline_status: "ready_to_plan",
            steps_completed: ["capture_idea", "evaluate_idea", "promote_idea"],
            idea_slug: slug,
            project_slug: project.slug,
            project_created: true,
            next_step: "plan_build",
            instructions: `Project "${slug}" created. Run hive_plan_build with project="${slug}" to generate a build plan, then hive_execute_step to start building.`,
          }, null, 2),
        }],
      };
    },
  );
}
