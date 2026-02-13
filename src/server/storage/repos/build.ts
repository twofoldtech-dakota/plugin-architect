import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { BuildPlan, BuildPhase, BuildTask, FileChange } from "../../types/build-plan.js";

export interface BuildPlanRow {
  id: string;
  project_id: string;
  description: string;
  status: string;
  current_phase: number;
  phases: string;
  session_id: string;
  created: string;
  updated: string;
}

export interface BuildTaskRow {
  id: string;
  build_plan_id: string;
  phase_id: string;
  name: string;
  description: string;
  depends_on: string;
  status: string;
  component: string | null;
  expected_files: string;
  file_changes: string;
  started: string | null;
  completed: string | null;
  error: string | null;
}

function rowToPlan(row: BuildPlanRow): BuildPlan & { id: string; project_id: string } {
  return {
    id: row.id,
    project_id: row.project_id,
    project: "", // filled by caller if needed
    description: row.description,
    status: row.status as BuildPlan["status"],
    current_phase: row.current_phase,
    phases: fromJson<BuildPhase[]>(row.phases) ?? [],
    session_id: row.session_id,
    created: row.created,
    updated: row.updated,
  };
}

function rowToTask(row: BuildTaskRow): BuildTask {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    depends_on: fromJson<string[]>(row.depends_on) ?? [],
    status: row.status as BuildTask["status"],
    component: row.component ?? undefined,
    expected_files: fromJson<string[]>(row.expected_files) ?? [],
    file_changes: fromJson<FileChange[]>(row.file_changes) ?? [],
    started: row.started ?? undefined,
    completed: row.completed ?? undefined,
    error: row.error ?? undefined,
  };
}

export const buildRepo = {
  createPlan(projectId: string, plan: Omit<BuildPlan, "project">): BuildPlan & { id: string; project_id: string } {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO build_plans (id, project_id, description, status, current_phase, phases, session_id, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectId, plan.description, plan.status, plan.current_phase,
      toJson(plan.phases), plan.session_id, plan.created, plan.updated,
    );
    return { ...plan, id, project_id: projectId, project: "" };
  },

  getPlanByProject(projectId: string): (BuildPlan & { id: string; project_id: string }) | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM build_plans WHERE project_id = ? ORDER BY created DESC LIMIT 1").get(projectId) as BuildPlanRow | undefined;
    return row ? rowToPlan(row) : undefined;
  },

  getPlanById(id: string): (BuildPlan & { id: string; project_id: string }) | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM build_plans WHERE id = ?").get(id) as BuildPlanRow | undefined;
    return row ? rowToPlan(row) : undefined;
  },

  updatePlan(id: string, updates: Partial<BuildPlan>): void {
    const db = getDb();
    const now = new Date().toISOString().split("T")[0];
    const fields: string[] = ["updated = ?"];
    const values: unknown[] = [now];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.current_phase !== undefined) { fields.push("current_phase = ?"); values.push(updates.current_phase); }
    if (updates.phases !== undefined) { fields.push("phases = ?"); values.push(toJson(updates.phases)); }
    if (updates.session_id !== undefined) { fields.push("session_id = ?"); values.push(updates.session_id); }

    values.push(id);
    db.prepare(`UPDATE build_plans SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  // Build tasks
  createTask(planId: string, phaseId: string, task: BuildTask): BuildTask {
    const db = getDb();
    db.prepare(`
      INSERT INTO build_tasks (id, build_plan_id, phase_id, name, description, depends_on, status, component, expected_files, file_changes, started, completed, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id, planId, phaseId, task.name, task.description,
      toJson(task.depends_on), task.status, task.component ?? null,
      toJson(task.expected_files), toJson(task.file_changes),
      task.started ?? null, task.completed ?? null, task.error ?? null,
    );
    return task;
  },

  getTasksByPlan(planId: string): BuildTask[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM build_tasks WHERE build_plan_id = ?").all(planId) as BuildTaskRow[];
    return rows.map(rowToTask);
  },

  updateTask(taskId: string, updates: Partial<BuildTask>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.file_changes !== undefined) { fields.push("file_changes = ?"); values.push(toJson(updates.file_changes)); }
    if (updates.started !== undefined) { fields.push("started = ?"); values.push(updates.started); }
    if (updates.completed !== undefined) { fields.push("completed = ?"); values.push(updates.completed); }
    if (updates.error !== undefined) { fields.push("error = ?"); values.push(updates.error); }

    if (fields.length === 0) return;
    values.push(taskId);
    db.prepare(`UPDATE build_tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },
};
