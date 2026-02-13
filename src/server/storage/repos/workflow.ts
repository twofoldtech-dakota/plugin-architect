import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { WorkflowEntry, WorkflowEntryType, WorkflowMood } from "../../types/workflow.js";

interface WorkflowRow {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string;
  project: string | null;
  mood: string | null;
  published: number;
  published_at: string | null;
  created: string;
  updated: string;
}

function rowToEntry(row: WorkflowRow): WorkflowEntry {
  return {
    id: row.id,
    type: row.type as WorkflowEntryType,
    title: row.title,
    content: row.content,
    tags: fromJson<string[]>(row.tags) ?? [],
    project: row.project ?? undefined,
    mood: (row.mood as WorkflowMood) ?? undefined,
    published: !!row.published,
    published_at: row.published_at ?? undefined,
    created: row.created,
    updated: row.updated,
  };
}

export interface ListWorkflowOptions {
  type?: WorkflowEntryType;
  project?: string;
  tag?: string;
  since?: string;
  until?: string;
  published?: boolean;
  limit?: number;
}

export const workflowRepo = {
  create(entry: Omit<WorkflowEntry, "id">): WorkflowEntry {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO workflow_entries (id, type, title, content, tags, project, mood, published, published_at, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entry.type, entry.title, entry.content,
      toJson(entry.tags), entry.project ?? null, entry.mood ?? null,
      entry.published ? 1 : 0, entry.published_at ?? null,
      entry.created, entry.updated,
    );
    return { ...entry, id };
  },

  getById(id: string): WorkflowEntry | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM workflow_entries WHERE id = ?").get(id) as WorkflowRow | undefined;
    return row ? rowToEntry(row) : undefined;
  },

  list(options: ListWorkflowOptions = {}): WorkflowEntry[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.type) {
      conditions.push("type = ?");
      params.push(options.type);
    }
    if (options.project) {
      conditions.push("project = ?");
      params.push(options.project);
    }
    if (options.since) {
      conditions.push("created >= ?");
      params.push(options.since);
    }
    if (options.until) {
      conditions.push("created <= ?");
      params.push(options.until);
    }
    if (options.published !== undefined) {
      conditions.push("published = ?");
      params.push(options.published ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit ? `LIMIT ${options.limit}` : "";

    const rows = db.prepare(`SELECT * FROM workflow_entries ${where} ORDER BY created DESC ${limit}`).all(...params) as WorkflowRow[];

    let entries = rows.map(rowToEntry);

    // Tag filtering in JS (tags stored as JSON array)
    if (options.tag) {
      const tag = options.tag.toLowerCase();
      entries = entries.filter((e) => e.tags.some((t) => t.toLowerCase() === tag));
    }

    return entries;
  },

  update(id: string, updates: Partial<Omit<WorkflowEntry, "id" | "created">>): WorkflowEntry | undefined {
    const db = getDb();
    const now = new Date().toISOString();
    const fields: string[] = ["updated = ?"];
    const values: unknown[] = [now];

    if (updates.type !== undefined) { fields.push("type = ?"); values.push(updates.type); }
    if (updates.title !== undefined) { fields.push("title = ?"); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push("content = ?"); values.push(updates.content); }
    if (updates.tags !== undefined) { fields.push("tags = ?"); values.push(toJson(updates.tags)); }
    if (updates.project !== undefined) { fields.push("project = ?"); values.push(updates.project); }
    if (updates.mood !== undefined) { fields.push("mood = ?"); values.push(updates.mood); }
    if (updates.published !== undefined) {
      fields.push("published = ?");
      values.push(updates.published ? 1 : 0);

      // Auto-set published_at on first publish
      if (updates.published) {
        const existing = this.getById(id);
        if (existing && !existing.published_at) {
          fields.push("published_at = ?");
          values.push(now);
        }
      }
    }
    if (updates.published_at !== undefined) { fields.push("published_at = ?"); values.push(updates.published_at); }

    values.push(id);
    db.prepare(`UPDATE workflow_entries SET ${fields.join(", ")} WHERE id = ?`).run(...values);

    return this.getById(id);
  },

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare("DELETE FROM workflow_entries WHERE id = ?").run(id);
    return result.changes > 0;
  },

  countByType(since?: string): Record<string, number> {
    const db = getDb();
    let rows: Array<{ type: string; count: number }>;
    if (since) {
      rows = db.prepare("SELECT type, COUNT(*) as count FROM workflow_entries WHERE created >= ? GROUP BY type").all(since) as Array<{ type: string; count: number }>;
    } else {
      rows = db.prepare("SELECT type, COUNT(*) as count FROM workflow_entries GROUP BY type").all() as Array<{ type: string; count: number }>;
    }
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.type] = row.count;
    }
    return counts;
  },
};
