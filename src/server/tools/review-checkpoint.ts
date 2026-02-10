import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { BuildPlan } from "../types/build-plan.js";

export function registerReviewCheckpoint(server: McpServer): void {
  server.tool(
    "hive_review_checkpoint",
    "Review the current build checkpoint — shows what's been built, pending work, and file changes. Approve to continue building or reject to pause.",
    {
      project: z.string().describe("Project slug"),
      action: z.enum(["review", "approve", "reject"]).describe("'review' to see status, 'approve' to continue, 'reject' to pause the build"),
      reason: z.string().optional().describe("Reason for rejection (if rejecting)"),
    },
    async ({ project, action, reason }) => {
      const planPath = join(HIVE_DIRS.projects, safeName(project), "build-plan.yaml");

      let plan: BuildPlan;
      try {
        plan = await readYaml<BuildPlan>(planPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `No build plan found for project "${project}".` }],
          isError: true,
        };
      }

      if (action === "approve") {
        // Advance to next phase
        if (plan.current_phase < plan.phases.length - 1) {
          plan.current_phase++;
        }
        plan.status = "in_progress";
        plan.updated = new Date().toISOString().split("T")[0];
        await writeYaml(planPath, plan);

        const nextPhase = plan.phases[plan.current_phase];
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "Checkpoint approved. Continuing build.",
                  next_phase: nextPhase
                    ? {
                        id: nextPhase.id,
                        name: nextPhase.name,
                        description: nextPhase.description,
                        tasks: nextPhase.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })),
                      }
                    : null,
                  instructions: "Run hive_execute_step to begin the next task.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (action === "reject") {
        plan.status = "paused";
        plan.updated = new Date().toISOString().split("T")[0];
        await writeYaml(planPath, plan);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "Build paused at checkpoint.",
                  reason: reason ?? "No reason given.",
                  instructions: "Fix the issues and run hive_review_checkpoint with action 'approve' to continue, or hive_rollback_step to undo the last step.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // action === "review" — return full checkpoint summary
      const completedTasks = plan.phases.flatMap((p) =>
        p.tasks
          .filter((t) => t.status === "completed")
          .map((t) => ({
            id: t.id,
            name: t.name,
            component: t.component,
            files_changed: t.file_changes.length,
          })),
      );

      const pendingTasks = plan.phases.flatMap((p) =>
        p.tasks
          .filter((t) => t.status === "pending")
          .map((t) => ({
            id: t.id,
            name: t.name,
            component: t.component,
          })),
      );

      const failedTasks = plan.phases.flatMap((p) =>
        p.tasks
          .filter((t) => t.status === "failed")
          .map((t) => ({
            id: t.id,
            name: t.name,
            error: t.error,
          })),
      );

      const allFileChanges = plan.phases.flatMap((p) =>
        p.tasks.flatMap((t) => t.file_changes.map((fc) => ({ task: t.id, ...fc }))),
      );

      const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
      const completedCount = completedTasks.length;
      const progress_pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                project: plan.project,
                status: plan.status,
                progress: `${completedCount}/${totalTasks} tasks (${progress_pct}%)`,
                current_phase: plan.phases[plan.current_phase]?.name ?? "done",
                phases: plan.phases.map((p) => ({
                  id: p.id,
                  name: p.name,
                  status: p.status,
                  tasks_completed: p.tasks.filter((t) => t.status === "completed").length,
                  tasks_total: p.tasks.length,
                })),
                completed_tasks: completedTasks,
                failed_tasks: failedTasks,
                pending_tasks: pendingTasks,
                file_changes: allFileChanges,
                instructions:
                  plan.status === "paused"
                    ? "Run with action 'approve' to continue or 'reject' to pause."
                    : "Build is in progress. Run hive_execute_step to continue.",
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
