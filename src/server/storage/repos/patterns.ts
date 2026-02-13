import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { Pattern, PatternFile, PatternLineageEntry } from "../../types/pattern.js";

export interface PatternRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  tags: string;
  stack: string | null;
  verified: number;
  created: string;
  used_in: string;
  files: string;
  notes: string | null;
  version: number | null;
  lineage: string | null;
}

function rowToPattern(row: PatternRow): Pattern {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    tags: fromJson<string[]>(row.tags) ?? [],
    stack: fromJson<string[]>(row.stack) ?? undefined,
    verified: !!row.verified,
    created: row.created,
    used_in: fromJson<string[]>(row.used_in) ?? [],
    files: fromJson<PatternFile[]>(row.files) ?? [],
    notes: row.notes ?? undefined,
    version: row.version ?? undefined,
    lineage: fromJson<PatternLineageEntry[]>(row.lineage) ?? undefined,
  };
}

export const patternsRepo = {
  create(pattern: Omit<Pattern, "id">): Pattern {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO patterns (id, slug, name, description, tags, stack, verified, created, used_in, files, notes, version, lineage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, pattern.slug, pattern.name, pattern.description,
      toJson(pattern.tags), pattern.stack ? toJson(pattern.stack) : null,
      pattern.verified ? 1 : 0, pattern.created, toJson(pattern.used_in),
      toJson(pattern.files), pattern.notes ?? null, pattern.version ?? 1,
      pattern.lineage ? toJson(pattern.lineage) : null,
    );
    return { ...pattern, id };
  },

  getBySlug(slug: string): Pattern | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM patterns WHERE slug = ?").get(slug) as PatternRow | undefined;
    return row ? rowToPattern(row) : undefined;
  },

  list(): Pattern[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM patterns ORDER BY created DESC").all() as PatternRow[];
    return rows.map(rowToPattern);
  },

  search(query: string, tags?: string[]): Pattern[] {
    const db = getDb();
    let rows: PatternRow[];
    if (tags && tags.length > 0) {
      const tagPatterns = tags.map((t) => `%"${t}"%`);
      const conditions = tagPatterns.map(() => "tags LIKE ?").join(" OR ");
      const pattern = `%${query}%`;
      rows = db.prepare(`
        SELECT * FROM patterns
        WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?) AND (${conditions})
        ORDER BY created DESC
      `).all(pattern, pattern, pattern, ...tagPatterns) as PatternRow[];
    } else {
      const pattern = `%${query}%`;
      rows = db.prepare(`
        SELECT * FROM patterns
        WHERE name LIKE ? OR description LIKE ? OR tags LIKE ?
        ORDER BY created DESC
      `).all(pattern, pattern, pattern) as PatternRow[];
    }
    return rows.map(rowToPattern);
  },

  upsert(pattern: Omit<Pattern, "id"> & { id?: string }): Pattern {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM patterns WHERE slug = ?").get(pattern.slug) as { id: string } | undefined;
    if (existing) {
      db.prepare(`
        UPDATE patterns SET name = ?, description = ?, tags = ?, stack = ?, verified = ?,
          used_in = ?, files = ?, notes = ?, version = ?, lineage = ?
        WHERE slug = ?
      `).run(
        pattern.name, pattern.description, toJson(pattern.tags),
        pattern.stack ? toJson(pattern.stack) : null, pattern.verified ? 1 : 0,
        toJson(pattern.used_in), toJson(pattern.files), pattern.notes ?? null,
        pattern.version ?? 1, pattern.lineage ? toJson(pattern.lineage) : null,
        pattern.slug,
      );
      return { ...pattern, id: existing.id };
    }
    return this.create(pattern);
  },

  updateUsedIn(slug: string, projectSlug: string): void {
    const db = getDb();
    const row = db.prepare("SELECT used_in FROM patterns WHERE slug = ?").get(slug) as { used_in: string } | undefined;
    if (!row) return;
    const usedIn = fromJson<string[]>(row.used_in) ?? [];
    if (!usedIn.includes(projectSlug)) {
      usedIn.push(projectSlug);
      db.prepare("UPDATE patterns SET used_in = ? WHERE slug = ?").run(toJson(usedIn), slug);
    }
  },
};
