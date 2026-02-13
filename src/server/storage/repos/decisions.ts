import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { Decision } from "../../types/architecture.js";

export interface DecisionRow {
  id: string;
  project_id: string;
  date: string;
  component: string;
  decision: string;
  reasoning: string;
  alternatives_considered: string;
  revisit_when: string | null;
}

function rowToDecision(row: DecisionRow): Decision & { project_id: string } {
  return {
    id: row.id,
    project_id: row.project_id,
    date: row.date,
    component: row.component,
    decision: row.decision,
    reasoning: row.reasoning,
    alternatives_considered: fromJson<string[]>(row.alternatives_considered) ?? [],
    revisit_when: row.revisit_when ?? undefined,
  };
}

export const decisionsRepo = {
  create(projectId: string, data: Omit<Decision, "id">): Decision & { project_id: string } {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO decisions (id, project_id, date, component, decision, reasoning, alternatives_considered, revisit_when)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectId, data.date, data.component, data.decision,
      data.reasoning, toJson(data.alternatives_considered ?? []),
      data.revisit_when ?? null,
    );
    return { id, project_id: projectId, ...data };
  },

  listByProject(projectId: string): (Decision & { project_id: string })[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM decisions WHERE project_id = ? ORDER BY date DESC").all(projectId) as DecisionRow[];
    return rows.map(rowToDecision);
  },

  listAll(): (Decision & { project_id: string })[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM decisions ORDER BY date DESC").all() as DecisionRow[];
    return rows.map(rowToDecision);
  },

  getById(id: string): (Decision & { project_id: string }) | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM decisions WHERE id = ?").get(id) as DecisionRow | undefined;
    return row ? rowToDecision(row) : undefined;
  },

  search(query: string): (Decision & { project_id: string })[] {
    const db = getDb();
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT * FROM decisions
      WHERE decision LIKE ? OR reasoning LIKE ? OR component LIKE ?
      ORDER BY date DESC
    `).all(pattern, pattern, pattern) as DecisionRow[];
    return rows.map(rowToDecision);
  },
};
