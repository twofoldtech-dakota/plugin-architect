import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { BuildPlan, BuildPhase } from "../../types/build-plan.js";

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
    const now = new Date().toISOString();
    const fields: string[] = ["updated = ?"];
    const values: unknown[] = [now];

    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }
    if (updates.current_phase !== undefined) { fields.push("current_phase = ?"); values.push(updates.current_phase); }
    if (updates.phases !== undefined) { fields.push("phases = ?"); values.push(toJson(updates.phases)); }
    if (updates.session_id !== undefined) { fields.push("session_id = ?"); values.push(updates.session_id); }

    values.push(id);
    db.prepare(`UPDATE build_plans SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },
};
