import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { projectsRepo, buildRepo } from "../storage/index.js";

export function registerReviewCheckpoint(server: McpServer): void {
  server.tool(
    "hive_review_checkpoint",
    "Review the current build checkpoint — shows what's been built, pending work, and file changes. Approve to continue building or reject to pause.",
    {
      project: z.string().describe("Project slug"),
      action: z.enum(["review", "approve", "reject"]).describe("'review' to see status, 'approve' to continue, 'reject' to pause the build"),
      reason: z.string().optional().describe("Reason for rejection (if rejecting)"),
    },
    { readOnlyHint: true },
    async ({ project, action, reason }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      const plan = buildRepo.getPlanByProject(proj.id);
      if (!plan) {
        return { content: [{ type: "text" as const, text: `No build plan found for project "${project}".` }], isError: true };
      }

      if (action === "approve") {
        if (plan.current_phase < plan.phases.length - 1) {
          plan.current_phase++;
        }
        buildRepo.updatePlan(plan.id, { status: "in_progress", current_phase: plan.current_phase });

        const nextPhase = plan.phases[plan.current_phase];
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message: "Checkpoint approved. Continuing build.",
              next_phase: nextPhase
                ? { id: nextPhase.id, name: nextPhase.name, description: nextPhase.description, tasks: nextPhase.tasks.map((t) => ({ id: t.id, name: t.name, status: t.status })) }
                : null,
              instructions: "Run hive_execute_step to begin the next task.",
            }, null, 2),
          }],
        };
      }

      if (action === "reject") {
        buildRepo.updatePlan(plan.id, { status: "paused" });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message: "Build paused at checkpoint.",
              reason: reason ?? "No reason given.",
              instructions: "Fix the issues and run hive_review_checkpoint with action 'approve' to continue, or hive_rollback_step to undo the last step.",
            }, null, 2),
          }],
        };
      }

      // action === "review"
      const completedTasks = plan.phases.flatMap((p) =>
        p.tasks.filter((t) => t.status === "completed").map((t) => ({ id: t.id, name: t.name, component: t.component, files_changed: t.file_changes.length })),
      );
      const pendingTasks = plan.phases.flatMap((p) =>
        p.tasks.filter((t) => t.status === "pending").map((t) => ({ id: t.id, name: t.name, component: t.component })),
      );
      const failedTasks = plan.phases.flatMap((p) =>
        p.tasks.filter((t) => t.status === "failed").map((t) => ({ id: t.id, name: t.name, error: t.error })),
      );
      const allFileChanges = plan.phases.flatMap((p) =>
        p.tasks.flatMap((t) => t.file_changes.map((fc) => ({ task: t.id, ...fc }))),
      );

      const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
      const completedCount = completedTasks.length;
      const progress_pct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project,
            status: plan.status,
            progress: `${completedCount}/${totalTasks} tasks (${progress_pct}%)`,
            current_phase: plan.phases[plan.current_phase]?.name ?? "done",
            phases: plan.phases.map((p) => ({
              id: p.id, name: p.name, status: p.status,
              tasks_completed: p.tasks.filter((t) => t.status === "completed").length,
              tasks_total: p.tasks.length,
            })),
            completed_tasks: completedTasks,
            failed_tasks: failedTasks,
            pending_tasks: pendingTasks,
            file_changes: allFileChanges,
            instructions: plan.status === "paused"
              ? "Run with action 'approve' to continue or 'reject' to pause."
              : "Build is in progress. Run hive_execute_step to continue.",
          }, null, 2),
        }],
      };
    },
  );
}
