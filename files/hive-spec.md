# Hive — MCP Server Spec

> Your personal knowledge-compounding MCP server that makes every build faster than the last.

## Core Concept

A single MCP server with two responsibilities:
1. **Architecture Engine** — structured planning that stays in sync with code
2. **Knowledge Registry** — verified, queryable knowledge that eliminates hallucination

Starts as a knowledge layer that supercharges Claude Code (or any MCP client). Grows into a full build orchestrator over time.

---

## Storage Structure

```
~/.hive/
├── config.yaml                  # Server config, defaults
├── ideas/
│   └── {idea-slug}.yaml         # Captured ideas with evaluations
├── projects/
│   └── {project-slug}/
│       ├── architecture.yaml    # Living architecture doc
│       ├── decisions.yaml       # Architecture decision log
│       └── apis.yaml            # Project-specific API contracts
├── knowledge/
│   ├── patterns/
│   │   ├── {pattern-slug}.yaml  # Verified code patterns
│   │   └── index.yaml           # Pattern registry with tags
│   ├── dependencies/
│   │   └── {pkg-name}/
│   │       ├── meta.yaml        # Version, description
│   │       └── surface.yaml     # API surface (types, methods, signatures)
│   └── stacks/
│       └── {stack-slug}.yaml    # Full stack presets (e.g., "next-drizzle-sqlite")
└── templates/
    ├── project/                  # Project scaffolding templates
    ├── feature/                  # Feature-level templates
    └── component/                # Component-level templates
```

### Why YAML?
- Human-readable and editable (you'll want to tweak things manually)
- Easy for Claude to read and write
- Git-friendly for versioning your knowledge base

---

## Data Models

### Architecture Doc (`architecture.yaml`)

```yaml
project: "project-name"
description: "One-liner"
created: "2026-02-09"
updated: "2026-02-09"
status: "building" # ideation | planning | building | shipping | archived

stack:
  runtime: "node"
  framework: "next"
  language: "typescript"
  database: "sqlite"
  orm: "drizzle"
  hosting: "vercel"

components:
  - name: "api"
    type: "api-routes"
    description: "REST API for core operations"
    files: ["src/app/api/**"]
    dependencies: ["database", "auth"]

  - name: "database"
    type: "data-layer"
    description: "SQLite with Drizzle ORM"
    files: ["src/db/**"]
    schema:
      tables:
        - name: "users"
          columns:
            - { name: "id", type: "text", primary: true }
            - { name: "email", type: "text", unique: true }
            - { name: "created_at", type: "integer" }

  - name: "auth"
    type: "service"
    description: "Session-based auth"
    files: ["src/lib/auth/**"]
    dependencies: ["database"]

data_flows:
  - name: "user-signup"
    steps:
      - "Client submits form → POST /api/auth/signup"
      - "API validates input → creates user in DB"
      - "API creates session → returns session token"

file_structure:
  src/:
    app/:
      api/: "API routes"
      "(dashboard)/": "Dashboard pages"
    db/:
      schema.ts: "Drizzle schema"
      index.ts: "DB connection"
    lib/:
      auth/: "Auth utilities"
```

### Decision Log (`decisions.yaml`)

```yaml
decisions:
  - id: "001"
    date: "2026-02-09"
    component: "database"
    decision: "Use SQLite over Postgres"
    reasoning: "Prototype phase, single-user, no concurrent write pressure. Migrate to Postgres if needed."
    alternatives_considered:
      - "Postgres — overkill for prototype"
      - "JSON files — no query capability"
    revisit_when: "Need concurrent writes or multi-user"

  - id: "002"
    date: "2026-02-09"
    component: "auth"
    decision: "Session-based auth, no third-party provider"
    reasoning: "Speed. No OAuth complexity for a tool only I'm using."
    revisit_when: "Adding external users"
```

### Code Pattern (`patterns/{slug}.yaml`)

```yaml
name: "drizzle-sqlite-setup"
description: "Standard Drizzle + SQLite setup with WAL mode"
tags: ["database", "drizzle", "sqlite"]
stack: ["typescript", "node"]
verified: true
created: "2026-02-09"
used_in: ["project-a", "project-b"]

files:
  - path: "src/db/index.ts"
    content: |
      import { drizzle } from 'drizzle-orm/better-sqlite3';
      import Database from 'better-sqlite3';
      import * as schema from './schema';

      const sqlite = new Database('local.db');
      sqlite.pragma('journal_mode = WAL');

      export const db = drizzle(sqlite, { schema });

  - path: "src/db/schema.ts"
    content: |
      import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

      // Add your tables here

notes: |
  Always enable WAL mode for better concurrent read performance.
  Place the .db file in project root, add to .gitignore.
```

### Dependency Surface (`dependencies/{pkg}/surface.yaml`)

```yaml
name: "drizzle-orm"
version: "0.34.x"
fetched: "2026-02-09"
source: "https://orm.drizzle.team/docs"

exports:
  - name: "drizzle"
    type: "function"
    signature: "drizzle(client: BetterSQLite3Database, config?: DrizzleConfig): DrizzleDB"
    description: "Creates a Drizzle database instance"

  - name: "sqliteTable"
    type: "function"
    signature: "sqliteTable(name: string, columns: Record<string, SQLiteColumn>): SQLiteTable"
    description: "Defines a SQLite table schema"

column_types:
  - "text(name) — TEXT column"
  - "integer(name) — INTEGER column"
  - "real(name) — REAL column"
  - "blob(name) — BLOB column"

common_patterns:
  - name: "Basic query"
    code: "const users = await db.select().from(schema.users);"
  - name: "Insert"
    code: "await db.insert(schema.users).values({ id, email });"
  - name: "Where clause"
    code: "await db.select().from(schema.users).where(eq(schema.users.id, id));"

gotchas:
  - "Don't use .returning() with SQLite — not supported in all drivers"
  - "Use eq(), ne(), etc. from drizzle-orm for where conditions, not raw strings"
```

### API Contract (`apis.yaml`)

```yaml
apis:
  - name: "internal-rest"
    base: "/api"
    endpoints:
      - method: "POST"
        path: "/auth/signup"
        body: { email: "string", password: "string" }
        response: { session_token: "string", user: "User" }
        errors:
          - { status: 409, message: "Email already exists" }
          - { status: 400, message: "Invalid input" }

  - name: "stripe"
    type: "external"
    base: "https://api.stripe.com/v1"
    auth: "Bearer token"
    endpoints:
      - method: "POST"
        path: "/customers"
        docs: "https://stripe.com/docs/api/customers/create"
```

### Stack Preset (`stacks/{slug}.yaml`)

```yaml
name: "next-drizzle-sqlite"
description: "Next.js + Drizzle + SQLite — fast prototype stack"
use_when: "Building a web app prototype that needs a database"
tags: ["web", "fullstack", "prototype"]

dependencies:
  production:
    - "next"
    - "react"
    - "react-dom"
    - "drizzle-orm"
    - "better-sqlite3"
  dev:
    - "typescript"
    - "@types/better-sqlite3"
    - "drizzle-kit"

patterns:
  - "drizzle-sqlite-setup"
  - "next-api-routes"
  - "session-auth"

file_structure:
  src/:
    app/:
      layout.tsx: "Root layout"
      page.tsx: "Home page"
      api/: "API routes"
    db/:
      index.ts: "DB connection"
      schema.ts: "Drizzle schema"
    lib/: "Shared utilities"

scripts:
  dev: "next dev"
  build: "next build"
  db:generate: "drizzle-kit generate"
  db:push: "drizzle-kit push"
```

---

## MCP Tool Definitions

### Discovery Tools

#### `hive_capture_idea`
Capture a raw idea and structure it into an evaluable concept.

```
Input:
  description: string    — raw brain dump of the idea
  problem?: string       — what problem does this solve?
  audience?: string      — who is this for?

Output:
  Structured concept saved to ~/.hive/ideas/{slug}.yaml:
  {
    name: string,
    slug: string,
    problem: string,
    audience: string,
    proposed_solution: string,
    assumptions: string[],       — things that must be true for this to work
    open_questions: string[],    — things you haven't figured out yet
    status: "raw" | "evaluated" | "approved" | "rejected" | "parked"
  }
```

#### `hive_evaluate_idea`
Run a structured evaluation against an idea to decide if it's worth building.

```
Input:
  idea: string           — idea slug
  
Output:
  Evaluation saved to the idea file:
  {
    feasibility: {
      score: 1-5,
      has_patterns: boolean,       — do you have existing patterns that apply?
      known_stack: boolean,        — is this a stack you've used before?
      estimated_sessions: number,  — rough build time based on similar projects
      unknowns: string[]           — things you'd need to figure out
    },
    competitive: {
      exists_already: boolean,
      differentiator: string,      — why build yours anyway?
      references: string[]         — known alternatives
    },
    scope: {
      mvp_definition: string,      — the absolute smallest useful version
      mvp_components: string[],    — what's in the MVP
      deferred: string[],          — what's NOT in the MVP
      full_vision: string          — where this could go
    },
    verdict: "build" | "park" | "kill" | "needs_more_thinking",
    reasoning: string
  }
```

#### `hive_list_ideas`
List all captured ideas with their status and verdict.

```
Input:
  status?: string        — filter by status

Output:
  All ideas with summary info
```

#### `hive_promote_idea`
Move an approved idea into a project (calls hive_init_project with the idea's scope).

```
Input:
  idea: string           — idea slug

Output:
  Project initialized from idea's MVP definition.
  Idea status updated to "approved".
  Architecture doc pre-populated with MVP components.
```

### Architecture Tools

#### `hive_init_project`
Initialize a new project with architecture doc.

```
Input:
  name: string         — project name / slug
  description: string  — what you're building
  stack?: string       — stack preset slug (e.g., "next-drizzle-sqlite")

Output:
  Created architecture.yaml with initial structure.
  Returns the full architecture doc for Claude to reference.

Side effects:
  Creates ~/.hive/projects/{name}/
  Creates architecture.yaml, decisions.yaml, apis.yaml
  If stack preset provided, pre-populates from preset
```

#### `hive_get_architecture`
Read the current architecture doc. **Claude should call this at the start of every coding session.**

```
Input:
  project: string      — project slug

Output:
  Full architecture.yaml contents + decisions log
```

#### `hive_update_architecture`
Update the architecture doc as the project evolves.

```
Input:
  project: string
  updates: object      — partial update to merge into architecture
  reason?: string      — why this changed (auto-logged to decisions)

Output:
  Updated architecture doc
```

#### `hive_log_decision`
Record an architectural decision.

```
Input:
  project: string
  component: string
  decision: string
  reasoning: string
  alternatives?: string[]
  revisit_when?: string

Output:
  Decision logged with auto-incremented ID
```

#### `hive_validate_against_spec`
Check if a proposed change aligns with the architecture.

```
Input:
  project: string
  action: string       — what Claude is about to do
  files?: string[]     — files it's about to create/modify

Output:
  { aligned: boolean, concerns: string[], suggestions: string[] }
```

#### `hive_check_progress`
Compare codebase against architecture to see what's built vs missing.

```
Input:
  project: string
  project_path: string  — path to the actual codebase

Output:
  { 
    built: Component[],
    in_progress: Component[],
    missing: Component[],
    coverage_pct: number 
  }
```

#### `hive_evaluate_feature`
Evaluate whether a proposed feature is real value or bloat.

```
Input:
  project: string
  feature: string        — what you're considering adding
  reasoning?: string     — why you think you need it

Output:
  {
    alignment: {
      score: 1-5,
      project_goals: string[],         — the project's stated goals
      supports_goals: string[],        — which goals this serves
      irrelevant_to_goals: string[],   — which goals this doesn't touch
      verdict: string                  — "core" | "nice-to-have" | "bloat" | "distraction"
    },
    effort_vs_impact: {
      estimated_effort: "trivial" | "small" | "medium" | "large",
      estimated_impact: "critical" | "high" | "medium" | "low",
      ratio: string                    — "worth it" | "questionable" | "not worth it"
    },
    existing_patterns: {
      has_patterns: boolean,
      matching_patterns: string[],     — patterns that could accelerate this
      net_effort_with_patterns: string — how much faster with existing knowledge
    },
    tradeoffs: {
      what_to_cut: string[],           — if you add this, consider dropping these
      complexity_added: string,        — what new complexity this introduces
      maintenance_burden: string       — ongoing cost of having this
    },
    recommendation: "build it" | "defer it" | "cut it" | "simplify it",
    simplified_alternative?: string    — if "simplify it", here's the leaner version
  }
```

### Knowledge Tools

#### `hive_register_pattern`
Save a verified code pattern from the current project.

```
Input:
  name: string
  description: string
  tags: string[]
  files: { path: string, content: string }[]
  notes?: string

Output:
  Pattern saved to knowledge/patterns/
```

#### `hive_find_patterns`
Search for relevant patterns.

```
Input:
  query: string        — natural language or tags
  stack?: string[]     — filter by stack

Output:
  Matching patterns with full content
```

#### `hive_register_dependency`
Cache a dependency's real API surface.

```
Input:
  name: string
  version: string
  surface: object      — exports, types, signatures, gotchas
  source?: string      — docs URL

Output:
  Dependency surface saved
```

#### `hive_check_dependency`
Look up a dependency's real API before using it.

```
Input:
  name: string

Output:
  Full surface.yaml or "not registered — consider registering"
```

#### `hive_register_api`
Register an external or internal API contract.

```
Input:
  project: string
  name: string
  type: "internal" | "external"
  base: string
  endpoints: Endpoint[]

Output:
  API contract saved to project
```

#### `hive_validate_code`
Sanity-check generated code against registered knowledge.

```
Input:
  code: string
  file_path: string
  project: string

Output:
  {
    issues: [
      { type: "unknown_import", detail: "foo-lib not in registered dependencies" },
      { type: "wrong_signature", detail: "drizzle() takes 2 args, not 3" },
      { type: "known_gotcha", detail: "Don't use .returning() with SQLite" }
    ],
    verified: boolean
  }
```

### Build Tools

#### `hive_scaffold_project`
Generate full project from a stack preset.

```
Input:
  name: string
  stack: string        — stack preset slug
  output_path: string  — where to create the project

Output:
  Project directory created with all files from preset + patterns
```

#### `hive_add_feature`
Drop in a feature using registered patterns.

```
Input:
  project: string
  feature: string      — natural language or pattern name
  project_path: string

Output:
  Files to create/modify, based on matching patterns + architecture
```

#### `hive_snapshot_patterns`
Extract patterns from current project back into the knowledge base.

```
Input:
  project: string
  project_path: string
  files: string[]      — files to extract as a pattern
  name: string
  tags: string[]

Output:
  Pattern saved, linked to project in used_in
```

### Meta Tools

#### `hive_list_projects`
List all tracked projects.

#### `hive_list_patterns`
List all registered patterns with tags.

#### `hive_list_stacks`
List all stack presets.

#### `hive_search_knowledge`
Full-text search across all knowledge (patterns, deps, decisions, architectures).

```
Input:
  query: string

Output:
  Ranked results across all knowledge types
```

---

## Compound Loop

This is how Hive gets smarter over time:

```
Have idea
  → hive_capture_idea (brain dump → structured concept)
  → hive_evaluate_idea (feasibility, scope, verdict)
  → hive_promote_idea (approved → project)

Build project
  → hive_init_project (pulls from stack presets + existing patterns)
  → Claude builds with architecture as guardrails
  → hive_evaluate_feature when scope starts creeping
  → hive_register_dependency as new libs are added
  → hive_log_decision as choices are made
  → hive_validate_code catches hallucinations
  → hive_snapshot_patterns extracts what worked

Next idea
  → hive_evaluate_idea is smarter (knows your patterns + history)
  → More patterns available
  → More dependencies pre-registered  
  → Past decisions inform new ones
  → Less hallucination surface
  → Faster build
```

By project 10: Claude has your entire playbook. Every library you use, every pattern you prefer, every architectural decision you've made. New projects are mostly assembly from verified parts.

---

## Implementation Plan

### Phase 0 — Discovery (build this first)
- Ideas storage (read/write YAML to ~/.hive/ideas/)
- `hive_capture_idea`, `hive_evaluate_idea`, `hive_list_ideas`
- `hive_promote_idea` (bridges into Phase 1)

### Phase 1 — Foundation
- Project storage layer (read/write YAML to ~/.hive/projects/)
- `hive_init_project`, `hive_get_architecture`, `hive_update_architecture`
- `hive_register_pattern`, `hive_find_patterns`
- `hive_register_dependency`, `hive_check_dependency`

### Phase 2 — Validation
- `hive_validate_against_spec`
- `hive_validate_code`
- `hive_log_decision`
- `hive_check_progress`
- `hive_evaluate_feature` (bloat check)

### Phase 3 — Acceleration
- `hive_scaffold_project` with stack presets
- `hive_add_feature`
- `hive_snapshot_patterns`
- `hive_search_knowledge`

### Phase 4 — Intelligence (Orchestrator Evolution)
- Auto-suggest patterns when starting similar projects
- Detect when architecture has drifted from spec
- Surface relevant decisions from past projects
- Dependency update tracking (flag when cached surface is outdated)
- Full build orchestration: plan → execute → validate → iterate

---

## Tech Stack for Hive

- **Runtime:** Node.js / TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Storage:** YAML files (via `yaml` package) in `~/.hive/`
- **Search:** Simple tag + keyword matching (Phase 1), embeddings later if needed
- **No database needed** — flat files are fine for personal use and git-friendly
