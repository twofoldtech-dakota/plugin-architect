import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { projectsRepo, buildRepo } from "../storage/index.js";

export function registerResumeBuild(server: McpServer): void {
  server.tool(
    "hive_resume_build",
    "Resume a build that was paused or started in a previous session. Returns the current state of the build plan so you can pick up where you left off.",
    {
      project: z.string().describe("Project slug"),
    },
    async ({ project }) => {
      const proj = projectsRepo.getBySlug(project);
      if (!proj) {
        return { content: [{ type: "text" as const, text: `Project "${project}" not found.` }], isError: true };
      }

      const plan = buildRepo.getPlanByProject(proj.id);
      if (!plan) {
        return { content: [{ type: "text" as const, text: `No build plan found for project "${project}". Run hive_plan_build first.` }], isError: true };
      }

      if (plan.status === "completed") {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ message: "Build is already complete. Nothing to resume.", status: "completed" }, null, 2) }],
        };
      }

      const previousSession = plan.session_id;
      const newSession = randomUUID();
      const newStatus = plan.status === "paused" ? "in_progress" : plan.status;
      buildRepo.updatePlan(plan.id, { session_id: newSession, status: newStatus as "in_progress" });

      const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
      const completedTasks = plan.phases.reduce((sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length, 0);
      const failedTasks = plan.phases.flatMap((p) =>
        p.tasks.filter((t) => t.status === "failed").map((t) => ({ id: t.id, name: t.name, error: t.error })),
      );

      // Find next actionable task
      const allTasks = plan.phases.flatMap((p) => p.tasks);
      const completedIds = new Set(allTasks.filter((t) => t.status === "completed").map((t) => t.id));
      let nextTask: { id: string; name: string; component?: string } | null = null;
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          if (task.status === "pending" && task.depends_on.every((dep) => completedIds.has(dep))) {
            nextTask = { id: task.id, name: task.name, component: task.component };
            break;
          }
        }
        if (nextTask) break;
      }

      const currentPhase = plan.phases[plan.current_phase];
      const atCheckpoint = currentPhase?.status === "completed" && currentPhase.checkpoint;

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            message: "Build resumed.",
            previous_session: previousSession,
            new_session: newSession,
            progress: `${completedTasks}/${totalTasks} tasks completed`,
            current_phase: currentPhase ? { id: currentPhase.id, name: currentPhase.name, status: currentPhase.status } : null,
            at_checkpoint: atCheckpoint,
            failed_tasks: failedTasks,
            next_task: nextTask,
            instructions: atCheckpoint
              ? "You're at a checkpoint. Run hive_review_checkpoint to approve or reject before continuing."
              : nextTask
                ? `Run hive_execute_step to continue with task "${nextTask.id}".`
                : failedTasks.length > 0
                  ? "Some tasks have failed. Fix the issues and retry, or use hive_rollback_step."
                  : "No tasks available. The build may need a checkpoint review.",
          }, null, 2),
        }],
      };
    },
  );
}
