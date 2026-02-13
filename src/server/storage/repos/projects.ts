import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { Architecture } from "../../types/architecture.js";

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  architecture: string;
  created: string;
  updated: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  architecture: Architecture;
  created: string;
  updated: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status,
    architecture: fromJson<Architecture>(row.architecture) ?? {
      project: row.name,
      description: row.description,
      created: row.created,
      updated: row.updated,
      status: "planning",
      stack: {},
      components: [],
      data_flows: [],
      file_structure: {},
    },
    created: row.created,
    updated: row.updated,
  };
}

export const projectsRepo = {
  create(data: { slug: string; name: string; description: string; status?: string; architecture?: Architecture }): Project {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = data.status ?? "planning";
    const arch: Architecture = data.architecture ?? {
      project: data.name,
      description: data.description,
      created: now,
      updated: now,
      status: "planning",
      stack: {},
      components: [],
      data_flows: [],
      file_structure: {},
    };
    db.prepare(`
      INSERT INTO projects (id, slug, name, description, status, architecture, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.slug, data.name, data.description, status, toJson(arch), now, now);
    return { id, slug: data.slug, name: data.name, description: data.description, status, architecture: arch, created: now, updated: now };
  },

  getBySlug(slug: string): Project | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as ProjectRow | undefined;
    return row ? rowToProject(row) : undefined;
  },

  getById(id: string): Project | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : undefined;
  },

  list(): Project[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM projects ORDER BY created DESC").all() as ProjectRow[];
    return rows.map(rowToProject);
  },

  updateArchitecture(slug: string, architecture: Architecture): Project | undefined {
    const db = getDb();
    const now = new Date().toISOString();
    architecture.updated = now;
    const result = db.prepare(`
      UPDATE projects SET architecture = ?, status = ?, updated = ? WHERE slug = ?
    `).run(toJson(architecture), architecture.status, now, slug);
    if (result.changes === 0) return undefined;
    return this.getBySlug(slug);
  },

  updateStatus(slug: string, status: string): Project | undefined {
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare("UPDATE projects SET status = ?, updated = ? WHERE slug = ?").run(status, now, slug);
    if (result.changes === 0) return undefined;
    return this.getBySlug(slug);
  },
};
