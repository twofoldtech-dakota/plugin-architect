import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { DependencySurface, DependencyExport, CommonPattern } from "../../types/dependency.js";

export interface DependencyRow {
  id: string;
  name: string;
  version: string;
  fetched: string;
  source: string | null;
  exports: string | null;
  column_types: string | null;
  common_patterns: string | null;
  gotchas: string | null;
}

function rowToDependency(row: DependencyRow): DependencySurface & { id: string } {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    exports: fromJson<DependencyExport[]>(row.exports) ?? undefined,
    column_types: fromJson<string[]>(row.column_types) ?? undefined,
    common_patterns: fromJson<CommonPattern[]>(row.common_patterns) ?? undefined,
    gotchas: fromJson<string[]>(row.gotchas) ?? undefined,
  };
}

export const dependenciesRepo = {
  upsert(dep: DependencySurface): DependencySurface & { id: string } {
    const db = getDb();
    const existing = db.prepare("SELECT id FROM dependencies WHERE name = ?").get(dep.name) as { id: string } | undefined;
    const now = new Date().toISOString().split("T")[0];

    if (existing) {
      db.prepare(`
        UPDATE dependencies SET version = ?, fetched = ?, source = ?, exports = ?,
          column_types = ?, common_patterns = ?, gotchas = ?
        WHERE name = ?
      `).run(
        dep.version, now, null,
        dep.exports ? toJson(dep.exports) : null,
        dep.column_types ? toJson(dep.column_types) : null,
        dep.common_patterns ? toJson(dep.common_patterns) : null,
        dep.gotchas ? toJson(dep.gotchas) : null,
        dep.name,
      );
      return { ...dep, id: existing.id };
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO dependencies (id, name, version, fetched, source, exports, column_types, common_patterns, gotchas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, dep.name, dep.version, now, null,
      dep.exports ? toJson(dep.exports) : null,
      dep.column_types ? toJson(dep.column_types) : null,
      dep.common_patterns ? toJson(dep.common_patterns) : null,
      dep.gotchas ? toJson(dep.gotchas) : null,
    );
    return { ...dep, id };
  },

  getByName(name: string): (DependencySurface & { id: string }) | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM dependencies WHERE name = ?").get(name) as DependencyRow | undefined;
    return row ? rowToDependency(row) : undefined;
  },

  list(): (DependencySurface & { id: string })[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM dependencies ORDER BY name").all() as DependencyRow[];
    return rows.map(rowToDependency);
  },
};
