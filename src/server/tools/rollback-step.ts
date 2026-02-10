import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { BuildPlan } from "../types/build-plan.js";

export function registerRollbackStep(server: McpServer): void {
  server.tool(
    "hive_rollback_step",
    "Undo the last completed or failed build step. Reverts created files (deletes them) and resets the task status to pending.",
    {
      project: z.string().describe("Project slug"),
      task_id: z.string().optional().describe("Specific task ID to rollback. If omitted, rolls back the most recently completed/failed task."),
      project_path: z.string().optional().describe("Absolute path to the project codebase (needed to delete created files)"),
    },
    async ({ project, task_id, project_path }) => {
      const planPath = join(HIVE_DIRS.projects, project, "build-plan.yaml");

      let plan: BuildPlan;
      try {
        plan = await readYaml<BuildPlan>(planPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `No build plan found for project "${project}".` }],
          isError: true,
        };
      }

      // Find the task to roll back
      const allTasks = plan.phases.flatMap((p) => p.tasks);
      let target = task_id ? allTasks.find((t) => t.id === task_id) : null;

      if (!target) {
        // Find the most recently completed or failed task
        const candidates = allTasks.filter((t) => t.status === "completed" || t.status === "failed");
        if (candidates.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No completed or failed tasks to roll back." }],
            isError: true,
          };
        }
        // Pick the one with the latest completed date, or just the last one
        target = candidates[candidates.length - 1];
      }

      if (target.status !== "completed" && target.status !== "failed") {
        return {
          content: [{ type: "text" as const, text: `Task "${target.id}" is ${target.status} — can only roll back completed or failed tasks.` }],
          isError: true,
        };
      }

      // Revert file changes
      const reverted: string[] = [];
      const revertErrors: string[] = [];

      if (project_path && target.file_changes.length > 0) {
        for (const change of target.file_changes) {
          const filePath = join(project_path, change.path);
          try {
            if (change.action === "created") {
              await unlink(filePath);
              reverted.push(`Deleted: ${change.path}`);
            } else if (change.action === "modified" && change.previous_content) {
              await writeFile(filePath, change.previous_content, "utf-8");
              reverted.push(`Restored: ${change.path}`);
            } else if (change.action === "modified") {
              revertErrors.push(`Cannot restore ${change.path} — no previous content recorded. Manual revert needed.`);
            } else if (change.action === "deleted" && change.previous_content) {
              await writeFile(filePath, change.previous_content, "utf-8");
              reverted.push(`Recreated: ${change.path}`);
            }
          } catch (err) {
            revertErrors.push(`Failed to revert ${change.path}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Reset task status
      target.status = "rolled_back";
      target.file_changes = [];
      target.completed = undefined;
      target.error = undefined;

      // Also reset any tasks that depended on this one and were in_progress
      for (const task of allTasks) {
        if (task.depends_on.includes(target.id) && task.status === "in_progress") {
          task.status = "pending";
          task.started = undefined;
        }
      }

      // Recalculate phase statuses
      for (const phase of plan.phases) {
        const statuses = phase.tasks.map((t) => t.status);
        if (statuses.every((s) => s === "completed")) {
          phase.status = "completed";
        } else if (statuses.some((s) => s === "in_progress" || s === "completed")) {
          phase.status = "in_progress";
        } else if (statuses.some((s) => s === "failed")) {
          phase.status = "failed";
        } else {
          phase.status = "pending";
        }
      }

      plan.updated = new Date().toISOString().split("T")[0];
      if (plan.status === "completed") plan.status = "in_progress";
      await writeYaml(planPath, plan);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Task "${target.id}" (${target.name}) rolled back.`,
                reverted_files: reverted,
                revert_errors: revertErrors.length > 0 ? revertErrors : undefined,
                instructions:
                  "The task is now in 'rolled_back' status. Run hive_execute_step to retry it or adjust the approach.",
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
