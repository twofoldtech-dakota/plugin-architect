import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { Antipattern } from "../../types/antipattern.js";

export interface AntipatternRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  context: string;
  why_bad: string;
  instead: string;
  tags: string;
  severity: string;
  learned_from: string | null;
  created: string;
}

function rowToAntipattern(row: AntipatternRow): Antipattern {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    context: row.context,
    why_bad: row.why_bad,
    instead: row.instead,
    tags: fromJson<string[]>(row.tags) ?? [],
    severity: row.severity as Antipattern["severity"],
    learned_from: row.learned_from ?? undefined,
    created: row.created,
  };
}

export const antipatternsRepo = {
  create(ap: Omit<Antipattern, "id">): Antipattern {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO antipatterns (id, slug, name, description, context, why_bad, instead, tags, severity, learned_from, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, ap.slug, ap.name, ap.description, ap.context, ap.why_bad,
      ap.instead, toJson(ap.tags), ap.severity, ap.learned_from ?? null, ap.created,
    );
    return { ...ap, id };
  },

  getBySlug(slug: string): Antipattern | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM antipatterns WHERE slug = ?").get(slug) as AntipatternRow | undefined;
    return row ? rowToAntipattern(row) : undefined;
  },

  list(): Antipattern[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM antipatterns ORDER BY created DESC").all() as AntipatternRow[];
    return rows.map(rowToAntipattern);
  },

  search(query: string): Antipattern[] {
    const db = getDb();
    const pattern = `%${query}%`;
    const rows = db.prepare(`
      SELECT * FROM antipatterns
      WHERE name LIKE ? OR description LIKE ? OR tags LIKE ? OR context LIKE ?
      ORDER BY created DESC
    `).all(pattern, pattern, pattern, pattern) as AntipatternRow[];
    return rows.map(rowToAntipattern);
  },
};
