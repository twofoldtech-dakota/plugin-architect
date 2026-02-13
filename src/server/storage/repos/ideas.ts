import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { Idea, Evaluation } from "../../types/idea.js";

export interface IdeaRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  problem: string;
  audience: string;
  proposed_solution: string;
  assumptions: string;
  open_questions: string;
  status: string;
  competitive_landscape: string | null;
  market_data: string | null;
  research_links: string | null;
  signals: string | null;
  skill_fit: string | null;
  created: string;
  updated: string;
}

export interface EvaluationRow {
  id: string;
  idea_id: string;
  feasibility_score: number;
  feasibility_has_patterns: number;
  feasibility_known_stack: number;
  feasibility_estimated_sessions: number;
  feasibility_unknowns: string;
  competitive_exists: number;
  competitive_differentiator: string;
  competitive_references: string;
  scope_mvp_definition: string;
  scope_mvp_components: string;
  scope_deferred: string;
  scope_full_vision: string;
  verdict: string;
  reasoning: string;
  created: string;
}

function rowToIdea(row: IdeaRow): Idea {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    problem: row.problem,
    audience: row.audience,
    proposed_solution: row.proposed_solution,
    assumptions: fromJson<string[]>(row.assumptions) ?? [],
    open_questions: fromJson<string[]>(row.open_questions) ?? [],
    status: row.status as Idea["status"],
    competitive_landscape: row.competitive_landscape ?? undefined,
    market_data: row.market_data ?? undefined,
    research_links: row.research_links ?? undefined,
    signals: row.signals ?? undefined,
    skill_fit: row.skill_fit ?? undefined,
    created: row.created,
    updated: row.updated,
  };
}

function rowToEvaluation(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    idea_id: row.idea_id,
    feasibility: {
      score: row.feasibility_score,
      has_patterns: !!row.feasibility_has_patterns,
      known_stack: !!row.feasibility_known_stack,
      estimated_sessions: row.feasibility_estimated_sessions,
      unknowns: fromJson<string[]>(row.feasibility_unknowns) ?? [],
    },
    competitive: {
      exists_already: !!row.competitive_exists,
      differentiator: row.competitive_differentiator,
      references: fromJson<string[]>(row.competitive_references) ?? [],
    },
    scope: {
      mvp_definition: row.scope_mvp_definition,
      mvp_components: fromJson<string[]>(row.scope_mvp_components) ?? [],
      deferred: fromJson<string[]>(row.scope_deferred) ?? [],
      full_vision: row.scope_full_vision,
    },
    verdict: row.verdict as Evaluation["verdict"],
    reasoning: row.reasoning,
    created: row.created,
  };
}

export const ideasRepo = {
  create(idea: Omit<Idea, "id">): Idea {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO ideas (id, slug, name, description, problem, audience, proposed_solution, assumptions, open_questions, status, competitive_landscape, market_data, research_links, signals, skill_fit, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, idea.slug, idea.name, idea.description, idea.problem, idea.audience,
      idea.proposed_solution, toJson(idea.assumptions), toJson(idea.open_questions),
      idea.status, idea.competitive_landscape ?? null, idea.market_data ?? null,
      idea.research_links ?? null, idea.signals ?? null, idea.skill_fit ?? null,
      idea.created, idea.updated,
    );
    return { ...idea, id };
  },

  getBySlug(slug: string): Idea | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM ideas WHERE slug = ?").get(slug) as IdeaRow | undefined;
    return row ? rowToIdea(row) : undefined;
  },

  getById(id: string): Idea | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM ideas WHERE id = ?").get(id) as IdeaRow | undefined;
    return row ? rowToIdea(row) : undefined;
  },

  list(status?: string): Idea[] {
    const db = getDb();
    let rows: IdeaRow[];
    if (status) {
      rows = db.prepare("SELECT * FROM ideas WHERE status = ? ORDER BY created DESC").all(status) as IdeaRow[];
    } else {
      rows = db.prepare("SELECT * FROM ideas ORDER BY created DESC").all() as IdeaRow[];
    }
    return rows.map(rowToIdea);
  },

  update(slug: string, updates: Partial<Idea>): Idea | undefined {
    const db = getDb();
    const existing = db.prepare("SELECT * FROM ideas WHERE slug = ?").get(slug) as IdeaRow | undefined;
    if (!existing) return undefined;

    const merged = { ...rowToIdea(existing), ...updates };
    db.prepare(`
      UPDATE ideas SET name = ?, description = ?, problem = ?, audience = ?,
        proposed_solution = ?, assumptions = ?, open_questions = ?, status = ?,
        competitive_landscape = ?, market_data = ?, research_links = ?, signals = ?,
        skill_fit = ?, updated = ?
      WHERE slug = ?
    `).run(
      merged.name, merged.description, merged.problem, merged.audience,
      merged.proposed_solution, toJson(merged.assumptions), toJson(merged.open_questions),
      merged.status, merged.competitive_landscape ?? null, merged.market_data ?? null,
      merged.research_links ?? null, merged.signals ?? null, merged.skill_fit ?? null,
      merged.updated, slug,
    );
    return merged;
  },

  // Evaluations
  createEvaluation(ideaId: string, evaluation: Omit<Evaluation, "id" | "idea_id" | "created">): Evaluation {
    const db = getDb();
    const id = randomUUID();
    const created = new Date().toISOString().split("T")[0];
    db.prepare(`
      INSERT INTO idea_evaluations (id, idea_id, feasibility_score, feasibility_has_patterns, feasibility_known_stack, feasibility_estimated_sessions, feasibility_unknowns, competitive_exists, competitive_differentiator, competitive_references, scope_mvp_definition, scope_mvp_components, scope_deferred, scope_full_vision, verdict, reasoning, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ideaId,
      evaluation.feasibility.score,
      evaluation.feasibility.has_patterns ? 1 : 0,
      evaluation.feasibility.known_stack ? 1 : 0,
      evaluation.feasibility.estimated_sessions,
      toJson(evaluation.feasibility.unknowns),
      evaluation.competitive.exists_already ? 1 : 0,
      evaluation.competitive.differentiator,
      toJson(evaluation.competitive.references),
      evaluation.scope.mvp_definition,
      toJson(evaluation.scope.mvp_components),
      toJson(evaluation.scope.deferred),
      evaluation.scope.full_vision,
      evaluation.verdict,
      evaluation.reasoning,
      created,
    );
    return { ...evaluation, id, idea_id: ideaId, created };
  },

  getEvaluation(ideaId: string): Evaluation | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM idea_evaluations WHERE idea_id = ? ORDER BY created DESC LIMIT 1").get(ideaId) as EvaluationRow | undefined;
    return row ? rowToEvaluation(row) : undefined;
  },
};
