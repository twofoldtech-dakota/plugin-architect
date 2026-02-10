import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { BuildPlan, BuildTask, FileChange } from "../types/build-plan.js";

/**
 * Find the next executable task: status is "pending" and all dependencies are "completed".
 */
function findNextTask(plan: BuildPlan): { phaseIdx: number; task: BuildTask } | null {
  const allTasks = plan.phases.flatMap((p) => p.tasks);
  const completedIds = new Set(allTasks.filter((t) => t.status === "completed").map((t) => t.id));

  for (let pi = 0; pi < plan.phases.length; pi++) {
    for (const task of plan.phases[pi].tasks) {
      if (task.status !== "pending") continue;
      if (task.depends_on.every((dep) => completedIds.has(dep))) {
        return { phaseIdx: pi, task };
      }
    }
  }
  return null;
}

export function registerExecuteStep(server: McpServer): void {
  server.tool(
    "hive_execute_step",
    "Execute the next step in a project's build plan. Returns the task details and instructions for Claude Code to carry out. After completing the work, call this tool again with the task_id and outcome to record the result.",
    {
      project: z.string().describe("Project slug"),
      task_id: z.string().optional().describe("Task ID to mark as completed (from a previous execute_step call)"),
      outcome: z.enum(["completed", "failed"]).optional().describe("Outcome of the previously executed task"),
      error: z.string().optional().describe("Error message if the task failed"),
      files_changed: z
        .array(
          z.object({
            path: z.string().describe("File path relative to project root"),
            action: z.enum(["created", "modified", "deleted"]).describe("What happened to the file"),
          }),
        )
        .optional()
        .describe("Files that were created, modified, or deleted during execution"),
      project_path: z.string().optional().describe("Absolute path to the project codebase (needed to snapshot file contents for rollback)"),
    },
    async ({ project, task_id, outcome, error, files_changed, project_path }) => {
      const planPath = join(HIVE_DIRS.projects, safeName(project), "build-plan.yaml");

      let plan: BuildPlan;
      try {
        plan = await readYaml<BuildPlan>(planPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `No build plan found for project "${project}". Run hive_plan_build first.` }],
          isError: true,
        };
      }

      // If reporting back on a completed task, update the plan
      if (task_id && outcome) {
        const allTasks = plan.phases.flatMap((p) => p.tasks);
        const task = allTasks.find((t) => t.id === task_id);
        if (!task) {
          return {
            content: [{ type: "text" as const, text: `Task "${task_id}" not found in the build plan.` }],
            isError: true,
          };
        }

        task.status = outcome;
        task.completed = new Date().toISOString().split("T")[0];
        if (error) task.error = error;

        // Record file changes for rollback capability
        if (files_changed && project_path) {
          const changes: FileChange[] = [];
          for (const fc of files_changed) {
            const change: FileChange = { path: fc.path, action: fc.action };
            // We don't snapshot previous content here — that would require reading
            // the file before it was changed. Instead we record what happened so
            // rollback can delete created files.
            changes.push(change);
          }
          task.file_changes = changes;
        }

        // Update phase status
        for (const phase of plan.phases) {
          const taskStatuses = phase.tasks.map((t) => t.status);
          if (taskStatuses.every((s) => s === "completed")) {
            phase.status = "completed";
          } else if (taskStatuses.some((s) => s === "in_progress" || s === "completed")) {
            phase.status = "in_progress";
          } else if (taskStatuses.some((s) => s === "failed")) {
            phase.status = "failed";
          }
        }

        // Check if the current phase just completed and has a checkpoint
        const currentPhase = plan.phases[plan.current_phase];
        if (currentPhase && currentPhase.status === "completed" && currentPhase.checkpoint) {
          plan.updated = new Date().toISOString().split("T")[0];
          plan.status = "paused";
          await writeYaml(planPath, plan);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: `Task ${task_id} marked as ${outcome}. Phase "${currentPhase.name}" is complete — checkpoint reached.`,
                    action: "Run hive_review_checkpoint to review progress before continuing.",
                    phase_completed: currentPhase.name,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        plan.updated = new Date().toISOString().split("T")[0];
        await writeYaml(planPath, plan);
      }

      // Find and return the next task to execute
      const next = findNextTask(plan);
      if (!next) {
        // Check if all tasks are done
        const allDone = plan.phases.every((p) => p.tasks.every((t) => t.status === "completed"));
        if (allDone) {
          plan.status = "completed";
          plan.updated = new Date().toISOString().split("T")[0];
          await writeYaml(planPath, plan);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ message: "Build plan complete! All tasks finished.", status: "completed" }, null, 2) }],
          };
        }

        // Some tasks may be blocked or failed
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "No executable tasks found. Some tasks may be blocked by failed dependencies.",
                  failed_tasks: plan.phases.flatMap((p) => p.tasks.filter((t) => t.status === "failed").map((t) => ({ id: t.id, name: t.name, error: t.error }))),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Mark task as in_progress
      next.task.status = "in_progress";
      next.task.started = new Date().toISOString().split("T")[0];
      plan.status = "in_progress";
      plan.current_phase = next.phaseIdx;
      plan.updated = new Date().toISOString().split("T")[0];
      await writeYaml(planPath, plan);

      // Read architecture for context
      let architecture: Architecture | null = null;
      try {
        architecture = await readYaml<Architecture>(join(HIVE_DIRS.projects, safeName(project), "architecture.yaml"));
      } catch {
        // Architecture is optional context
      }

      const component = architecture?.components.find((c) => c.name === next.task.component);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Execute this task next:`,
                task: {
                  id: next.task.id,
                  name: next.task.name,
                  description: next.task.description,
                  component: next.task.component,
                  expected_files: next.task.expected_files,
                  depends_on: next.task.depends_on,
                },
                component_detail: component
                  ? {
                      type: component.type,
                      description: component.description,
                      files: component.files,
                      dependencies: component.dependencies,
                    }
                  : null,
                instructions: `After completing this task, call hive_execute_step again with task_id="${next.task.id}" and outcome="completed" (or "failed") along with files_changed to record what was done.`,
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
