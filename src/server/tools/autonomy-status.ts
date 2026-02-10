import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { BuildPlan } from "../types/build-plan.js";

interface SessionInfo {
  project: string;
  session_id: string;
  status: string;
  progress: string;
  current_phase?: string;
  risk_level: "low" | "medium" | "high";
  pending_action?: string;
  updated: string;
}

function assessRisk(plan: BuildPlan): "low" | "medium" | "high" {
  const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completedTasks = plan.phases.reduce(
    (sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length,
    0,
  );
  const failedTasks = plan.phases.reduce(
    (sum, p) => sum + p.tasks.filter((t) => t.status === "failed").length,
    0,
  );

  if (failedTasks > 2) return "high";
  if (failedTasks > 0 || completedTasks / Math.max(totalTasks, 1) < 0.3) return "medium";
  return "low";
}

export function registerAutonomyStatus(server: McpServer): void {
  server.tool(
    "hive_autonomy_status",
    "Manage autonomous build sessions. View status, approve/reject pending actions, pause or resume sessions.",
    {
      action: z
        .enum(["status", "approve", "reject", "pause", "resume"])
        .describe("Action to perform"),
      session_id: z
        .string()
        .optional()
        .describe("Session ID (required for approve/reject/pause/resume)"),
    },
    async ({ action, session_id }) => {
      // Scan all projects for active build plans
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        projectDirs = [];
      }

      const sessions: SessionInfo[] = [];
      const plansByProject = new Map<string, { plan: BuildPlan; path: string }>();

      for (const dir of projectDirs) {
        const planPath = join(HIVE_DIRS.projects, dir, "build-plan.yaml");
        try {
          const plan = await readYaml<BuildPlan>(planPath);
          plansByProject.set(dir, { plan, path: planPath });

          if (plan.status === "completed") continue; // Skip completed builds

          const totalTasks = plan.phases.reduce((sum, p) => sum + p.tasks.length, 0);
          const completedTasks = plan.phases.reduce(
            (sum, p) => sum + p.tasks.filter((t) => t.status === "completed").length,
            0,
          );
          const currentPhase = plan.phases[plan.current_phase];
          const atCheckpoint = currentPhase?.status === "completed" && currentPhase.checkpoint;

          sessions.push({
            project: dir,
            session_id: plan.session_id,
            status: plan.status,
            progress: `${completedTasks}/${totalTasks} tasks`,
            current_phase: currentPhase?.name,
            risk_level: assessRisk(plan),
            pending_action: atCheckpoint
              ? "Checkpoint review required"
              : plan.status === "paused"
                ? "Paused — resume to continue"
                : undefined,
            updated: plan.updated,
          });
        } catch {
          continue;
        }
      }

      // Handle status action
      if (action === "status") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  active_sessions: sessions.filter((s) => s.status === "in_progress").length,
                  paused_sessions: sessions.filter((s) => s.status === "paused").length,
                  awaiting_approval: sessions.filter((s) => s.pending_action != null).length,
                  sessions,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // All other actions require a session_id
      if (!session_id) {
        return {
          content: [{ type: "text" as const, text: `A session_id is required for the "${action}" action.` }],
          isError: true,
        };
      }

      // Find the session's project
      const targetSession = sessions.find((s) => s.session_id === session_id);
      if (!targetSession) {
        return {
          content: [{ type: "text" as const, text: `Session "${session_id}" not found.` }],
          isError: true,
        };
      }

      const entry = plansByProject.get(targetSession.project);
      if (!entry) {
        return {
          content: [{ type: "text" as const, text: `Build plan not found for project "${targetSession.project}".` }],
          isError: true,
        };
      }

      const { plan, path: planPath } = entry;

      switch (action) {
        case "approve": {
          if (plan.status !== "paused") {
            return {
              content: [{ type: "text" as const, text: "Session is not paused — nothing to approve." }],
              isError: true,
            };
          }
          plan.status = "in_progress";
          // Advance current_phase if current phase is completed
          if (
            plan.phases[plan.current_phase]?.status === "completed" &&
            plan.current_phase < plan.phases.length - 1
          ) {
            plan.current_phase++;
          }
          plan.updated = new Date().toISOString().split("T")[0];
          await writeYaml(planPath, plan);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: "Session approved and resumed.",
                    project: targetSession.project,
                    status: "in_progress",
                    next_action: "Run hive_execute_step to continue building.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "reject": {
          if (plan.status !== "paused") {
            return {
              content: [{ type: "text" as const, text: "Session is not paused — nothing to reject." }],
              isError: true,
            };
          }
          // Roll back the last completed task in the current phase
          const currentPhase = plan.phases[plan.current_phase];
          if (currentPhase) {
            const lastCompleted = [...currentPhase.tasks]
              .reverse()
              .find((t) => t.status === "completed");
            if (lastCompleted) {
              lastCompleted.status = "pending";
              lastCompleted.completed = undefined;
            }
          }
          plan.updated = new Date().toISOString().split("T")[0];
          await writeYaml(planPath, plan);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: "Pending action rejected. Last task reverted to pending.",
                    project: targetSession.project,
                    status: plan.status,
                    instructions: "Use hive_rollback_step if you need to undo file changes.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "pause": {
          if (plan.status !== "in_progress") {
            return {
              content: [{ type: "text" as const, text: "Session is not running — cannot pause." }],
              isError: true,
            };
          }
          plan.status = "paused";
          plan.updated = new Date().toISOString().split("T")[0];
          await writeYaml(planPath, plan);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: "Session paused.",
                    project: targetSession.project,
                    status: "paused",
                    instructions: "Use hive_autonomy_status with action=resume to continue.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        case "resume": {
          if (plan.status !== "paused") {
            return {
              content: [{ type: "text" as const, text: "Session is not paused — cannot resume." }],
              isError: true,
            };
          }
          plan.status = "in_progress";
          plan.updated = new Date().toISOString().split("T")[0];
          await writeYaml(planPath, plan);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    message: "Session resumed.",
                    project: targetSession.project,
                    status: "in_progress",
                    next_action: "Run hive_execute_step to continue building.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
            isError: true,
          };
      }
    },
  );
}
