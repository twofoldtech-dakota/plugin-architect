import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { HIVE_ROOT, DB_PATH } from "./paths.js";

let _db: Database.Database | null = null;

const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  problem TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  proposed_solution TEXT NOT NULL DEFAULT '',
  assumptions TEXT NOT NULL DEFAULT '[]',
  open_questions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'raw',
  competitive_landscape TEXT,
  market_data TEXT,
  research_links TEXT,
  signals TEXT,
  skill_fit TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idea_evaluations (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  feasibility_score INTEGER NOT NULL,
  feasibility_has_patterns INTEGER NOT NULL DEFAULT 0,
  feasibility_known_stack INTEGER NOT NULL DEFAULT 0,
  feasibility_estimated_sessions INTEGER NOT NULL DEFAULT 0,
  feasibility_unknowns TEXT NOT NULL DEFAULT '[]',
  competitive_exists INTEGER NOT NULL DEFAULT 0,
  competitive_differentiator TEXT NOT NULL DEFAULT '',
  competitive_references TEXT NOT NULL DEFAULT '[]',
  scope_mvp_definition TEXT NOT NULL DEFAULT '',
  scope_mvp_components TEXT NOT NULL DEFAULT '[]',
  scope_deferred TEXT NOT NULL DEFAULT '[]',
  scope_full_vision TEXT NOT NULL DEFAULT '',
  verdict TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning',
  architecture TEXT NOT NULL DEFAULT '{}',
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  component TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  alternatives_considered TEXT NOT NULL DEFAULT '[]',
  revisit_when TEXT
);

CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  stack TEXT,
  verified INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL,
  used_in TEXT NOT NULL DEFAULT '[]',
  files TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  version INTEGER DEFAULT 1,
  lineage TEXT
);

CREATE TABLE IF NOT EXISTS dependencies (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  fetched TEXT NOT NULL,
  source TEXT,
  exports TEXT,
  column_types TEXT,
  common_patterns TEXT,
  gotchas TEXT
);

CREATE TABLE IF NOT EXISTS antipatterns (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  context TEXT NOT NULL DEFAULT '',
  why_bad TEXT NOT NULL DEFAULT '',
  instead TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  severity TEXT NOT NULL DEFAULT 'warning',
  learned_from TEXT,
  created TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS build_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning',
  current_phase INTEGER NOT NULL DEFAULT 0,
  phases TEXT NOT NULL DEFAULT '[]',
  session_id TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  customers INTEGER,
  source TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  project TEXT,
  recurring INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS backlog_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'improvement',
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT,
  created TEXT NOT NULL,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  billing TEXT NOT NULL DEFAULT '{}',
  projects TEXT NOT NULL DEFAULT '[]',
  contracts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created TEXT NOT NULL,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project TEXT,
  date TEXT NOT NULL,
  due_date TEXT,
  line_items TEXT NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  tax_rate REAL,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_link TEXT,
  notes TEXT,
  created TEXT NOT NULL,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS workflow_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  project TEXT,
  mood TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

-- Indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_idea_evaluations_idea ON idea_evaluations(idea_id);
CREATE INDEX IF NOT EXISTS idx_build_plans_project ON build_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_backlog_items_project ON backlog_items(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflow_type ON workflow_entries(type);
CREATE INDEX IF NOT EXISTS idx_workflow_created ON workflow_entries(created);
CREATE INDEX IF NOT EXISTS idx_workflow_project ON workflow_entries(project);
CREATE INDEX IF NOT EXISTS idx_workflow_published ON workflow_entries(published);

-- Compound indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_revenue_project_date ON revenue_entries(project, date);
CREATE INDEX IF NOT EXISTS idx_expenses_project_date ON expenses(project, date);
CREATE INDEX IF NOT EXISTS idx_backlog_project_status ON backlog_items(project_id, status);
`;

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    sql: `DROP TABLE IF EXISTS build_tasks;`,
  },
  {
    version: 3,
    sql: `
CREATE TABLE IF NOT EXISTS workflow_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  project TEXT,
  mood TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workflow_type ON workflow_entries(type);
CREATE INDEX IF NOT EXISTS idx_workflow_created ON workflow_entries(created);
CREATE INDEX IF NOT EXISTS idx_workflow_project ON workflow_entries(project);
CREATE INDEX IF NOT EXISTS idx_workflow_published ON workflow_entries(published);
`,
  },
];

function runMigrations(db: Database.Database): void {
  const row = db.prepare("SELECT MAX(version) as v FROM schema_version").get() as { v: number } | undefined;
  const current = row?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > current) {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migration.version);
    }
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  mkdirSync(HIVE_ROOT, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Run schema if needed
  const hasSchema = _db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
    .get();

  if (!hasSchema) {
    _db.exec(SCHEMA_DDL);
    _db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(1);
  }

  runMigrations(_db);

  return _db;
}

/** Serialize a value to JSON for storage in a TEXT column. */
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Parse a JSON TEXT column back into a typed value. */
export function fromJson<T>(text: string | null | undefined): T {
  if (text == null || text === "") return null as T;
  return JSON.parse(text) as T;
}
