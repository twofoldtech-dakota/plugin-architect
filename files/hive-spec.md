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

  - name: "polar"
    type: "external"
    base: "https://api.polar.sh/v1"
    auth: "Bearer token"
    endpoints:
      - method: "POST"
        path: "/products"
        docs: "https://docs.polar.sh/api-reference"
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

## Phase 11-16 Storage Additions

```
~/.hive/
  meta/                                  # Phase 11 — Self-Replication
    telemetry.yaml                       # Tool call log: tool, args, duration, outcome, user_action
    evolution_log.yaml                   # History of self-modifications
    proposals/
      {id}.yaml                          # Improvement proposals with evidence
    versions/
      {timestamp}/                       # Rollback snapshots

  integrations/                          # Phase 12 — Revenue
    polar.yaml                           # Polar.sh API key (via env var), connected products
    analytics.yaml                       # Plausible/PostHog/Simple Analytics keys

  revenue/                               # Phase 12 — Revenue
    snapshots/
      {date}.yaml                        # Daily MRR/ARR/churn/LTV across all products
    experiments/
      {id}.yaml                          # A/B test definitions and results
    forecasts/
      {project}.yaml                     # Revenue projections

  marketing/                             # Phase 13 — Content & Marketing
    {project}/
      launch-playbook.yaml               # Generated launch assets
      content-calendar.yaml              # Scheduled content with status
      campaigns/
        {id}.yaml                        # Multi-channel campaign + results
      assets/
        landing-page.html
        readme.md
        changelog.md                     # Auto-generated from git + decisions
    analytics/
      content-performance.yaml           # Traffic/conversion attribution per content piece
      messaging-effectiveness.yaml       # Which messages resonated

  business/                              # Phase 14 — Business Operations
    entity.yaml                          # Business name, EIN (env var), address, payment methods
    clients/
      {slug}.yaml                        # Client profiles, billing, projects, contracts
    invoices/
      {id}.yaml                          # Invoice records with line items + status
    contracts/
      templates/                         # saas-terms, freelance, privacy-policy, etc.
      generated/
        {id}.yaml                        # Generated contracts with signing status
    expenses/
      {year}/
        {month}.yaml                     # Categorized expenses by vendor + project
    compliance/
      {project}/
        audit.yaml                       # Last compliance scan results
        privacy-policy.md
        terms.md
    tax/
      {year}.yaml                        # Annual tax summary

  marketplace/                           # Phase 15 — Knowledge Marketplace
    packages/
      {slug}/
        manifest.yaml                    # Metadata, pricing, version, source patterns
        contents/                        # Sanitized distributable files
        preview.yaml                     # Public preview (no source code)
        analytics.yaml                   # Downloads, ratings, revenue
    export-rules.yaml                    # What's exportable, secrets exclusion, min confidence
    storefront.yaml                      # Marketplace profile + settings

  mesh/                                  # Phase 16 — Hive Mesh
    identity.yaml                        # Peer ID (public key), display name, specialties
    peers/
      {peer_id}.yaml                     # Known peers with reputation + trust level
    shared/
      outbound/                          # Anonymized patterns/anti-patterns you've shared
        patterns/
        anti-patterns/
        benchmarks/
      inbound/                           # Knowledge received from mesh
        patterns/
        anti-patterns/
        benchmarks/
    delegations/
      {id}.yaml                          # A2A task delegations (sent + received)
    reputation.yaml                      # Your reputation score + history
    mesh-settings.yaml                   # What to share, accept, auto-merge
```

---

## Phase 11-16 Data Models

### Telemetry (`meta/telemetry.yaml`) — Phase 11

```yaml
entries:
  - timestamp: "2026-04-15T10:32:00Z"
    tool: "hive_find_patterns"
    args: { query: "auth middleware", stack: ["typescript"] }
    duration_ms: 45
    result_size: 3              # number of results returned
    user_action: "used"         # used | ignored | re-called | errored
    session: "project-xyz"
```

### Proposals (`meta/proposals/{id}.yaml`) — Phase 11

```yaml
id: "prop-001"
type: "new_tool"                # new_tool | refactor_tool | remove_tool | schema_change | ui_change
status: "pending"               # pending | approved | rejected | applied | rolled_back
created: "2026-04-20"
target: null                    # existing tool name if refactor/remove
proposal:
  name: "hive_quick_pattern"
  description: "Shortcut to register a pattern from a single file without full metadata"
  reasoning: |
    In the last 30 days, hive_register_pattern was called 12 times.
    8 of those calls had only 1 file and minimal tags.
    A simplified tool would save ~30 seconds per call.
  input_schema:
    file_path: "string — path to the file"
    name: "string — pattern name"
    tags: "string[] — optional, auto-inferred if omitted"
  output: "Pattern saved with auto-generated metadata"
  estimated_effort: "trivial"
evidence:
  tool_calls_analyzed: 12
  pattern_detected: "single-file registration with minimal metadata"
  time_saved_per_call: "~30s"
```

### Evolution Log (`meta/evolution_log.yaml`) — Phase 11

```yaml
evolutions:
  - id: "evo-001"
    date: "2026-04-21"
    type: "new_tool"
    proposal_id: "prop-001"
    description: "Added hive_quick_pattern — single-file pattern registration shortcut"
    files_changed:
      - "src/server/tools/quick-pattern.ts"
      - "src/server/index.ts"
    rollback_version: "2026-04-21T09:00:00Z"
    outcome: "active"           # active | rolled_back
```

### Revenue Snapshot (`revenue/snapshots/{date}.yaml`) — Phase 12

```yaml
date: "2026-05-01"
total_mrr: 4250.00
total_arr: 51000.00
products:
  - project: "saas-tool-x"
    mrr: 2800.00
    customers: 142
    churn_rate: 3.2            # monthly %
    ltv: 875.00
    plan_breakdown:
      free: 890
      starter: 98
      pro: 44
    trend: "growing"           # growing | stable | declining | new
    growth_rate: 8.5           # month-over-month %
```

### Experiment (`revenue/experiments/{id}.yaml`) — Phase 12

```yaml
id: "exp-001"
project: "saas-tool-x"
type: "pricing"
status: "running"              # draft | running | completed | cancelled
started: "2026-04-15"
hypothesis: "Lowering starter plan from $19 to $14 will increase conversions enough to offset per-user revenue loss"
variants:
  control:
    description: "Starter at $19/mo"
    traffic_pct: 50
    conversions: 23
    revenue: 437.00
  treatment:
    description: "Starter at $14/mo"
    traffic_pct: 50
    conversions: 41
    revenue: 574.00
duration_days: 30
confidence: 0.94               # statistical confidence
result: null                   # populated when completed
recommendation: null
```

### Integration (`integrations/polar.yaml`) — Phase 12

```yaml
provider: "polar"
api_key_env: "HIVE_POLAR_KEY"        # references env var, never stored in plaintext
connected_projects:
  - project: "saas-tool-x"
    polar_product_id: "prod_xxx"
  - project: "dev-utility-y"
    polar_product_id: "prod_yyy"
sync_frequency: "daily"
last_sync: "2026-05-01T06:00:00Z"
```

### Launch Playbook (`marketing/{project}/launch-playbook.yaml`) — Phase 13

```yaml
project: "saas-tool-x"
generated: "2026-05-10"
audience: "Solo developers building SaaS products"
value_prop: "Ship faster by eliminating AI hallucination in your coding workflow"
assets:
  landing_page:
    status: "generated"        # generated | reviewed | published
    url: null
    sections:
      - hero: "Stop Claude from hallucinating your APIs"
      - features:
          - title: "Architecture Guardrails"
            description: "Every coding session starts with your real architecture, not guesses"
            source_component: "architecture-engine"
          - title: "Verified Patterns"
            description: "200+ battle-tested code patterns from real projects"
            source_component: "knowledge-registry"
      - social_proof: null
      - pricing: { from_polar: true }
  readme:
    status: "generated"
    content: "..."
  tweets:
    - type: "launch_thread"
      status: "draft"
      posts:
        - "🚀 Just shipped {product}: {one-liner}"
        - "The problem: {problem statement from idea}"
        - "How it works: {3-step flow from architecture}"
        - "Try it: {url}"
  product_hunt:
    tagline: "..."
    description: "..."
    first_comment: "..."
    maker_story: "..."
  changelog:
    status: "auto_updating"
    entries: []
  email_sequences:
    onboarding:
      - { day: 0, subject: "Welcome to {product}", body: "..." }
      - { day: 3, subject: "Did you try {key feature}?", body: "..." }
      - { day: 7, subject: "Builders who use {pattern} ship 3x faster", body: "..." }
```

### Content Performance (`marketing/analytics/content-performance.yaml`) — Phase 13

```yaml
entries:
  - content_id: "tweet-launch-001"
    project: "saas-tool-x"
    type: "tweet"
    published: "2026-05-12"
    impressions: 12400
    clicks: 340
    conversions: 23
    conversion_rate: 6.8
    revenue_attributed: 322.00
```

### Business Entity (`business/entity.yaml`) — Phase 14

```yaml
name: "Twofold Technologies"
type: "sole_proprietorship"
ein: "env:HIVE_EIN"
state: "Kansas"
address: "env:HIVE_BUSINESS_ADDRESS"
payment_methods:
  - type: "polar"
    organization_id: "org_xxx"
```

### Client (`business/clients/{slug}.yaml`) — Phase 14

```yaml
name: "Acme Corp"
slug: "acme-corp"
contact:
  name: "Jane Smith"
  email: "jane@acme.com"
  role: "VP Engineering"
type: "consulting"
billing:
  rate: 175
  currency: "USD"
  terms: "net_30"
  total_invoiced: 24500.00
  total_paid: 21000.00
  outstanding: 3500.00
projects:
  - project: "acme-migration"
    status: "active"
    started: "2026-03-01"
    hours_logged: 140
contracts:
  - contract_id: "con-001"
    type: "freelance"
    signed: "2026-03-01"
    expires: "2026-09-01"
```

### Invoice (`business/invoices/{id}.yaml`) — Phase 14

```yaml
id: "INV-2026-042"
client: "acme-corp"
project: "acme-migration"
status: "sent"                 # draft | sent | paid | overdue | cancelled
created: "2026-05-01"
due: "2026-05-31"
line_items:
  - description: "DXP migration consulting — April 2026"
    quantity: 40
    rate: 175.00
    amount: 7000.00
  - description: "Hosting setup and configuration"
    quantity: 1
    rate: 500.00
    amount: 500.00
subtotal: 7500.00
tax: 0
total: 7500.00
payment_instructions: "Pay via Polar checkout: {url}"
reminders_sent: 0
```

### Expenses (`business/expenses/{year}/{month}.yaml`) — Phase 14

```yaml
month: "2026-05"
total: 487.50
categories:
  hosting:
    total: 245.00
    items:
      - { vendor: "Vercel", amount: 20.00, project: "saas-tool-x" }
      - { vendor: "Railway", amount: 25.00, project: "api-guard" }
      - { vendor: "Hetzner", amount: 200.00, project: "fleet-vps" }
  apis:
    total: 142.50
    items:
      - { vendor: "Anthropic", amount: 120.00, note: "Claude API" }
      - { vendor: "Resend", amount: 22.50, project: "saas-tool-x" }
  tools:
    total: 100.00
    items:
      - { vendor: "GitHub", amount: 4.00, note: "Pro plan" }
      - { vendor: "Figma", amount: 96.00, note: "Annual, amortized" }
```

### Package Manifest (`marketplace/packages/{slug}/manifest.yaml`) — Phase 15

```yaml
name: "Next.js SaaS Starter"
slug: "next-saas-starter"
version: "2.1.0"
description: "Production-ready SaaS boilerplate with auth, billing, and admin dashboard. Battle-tested across 8 products."
author: "Dakota / Twofold Technologies"
license: "commercial"
pricing:
  type: "one_time"
  price: 49.00
  currency: "USD"
type: "stack_preset"           # pattern | stack_preset | decision_framework | hive_template
tags: ["saas", "next.js", "drizzle", "auth", "polar", "typescript"]
source_patterns:
  - "drizzle-sqlite-setup"
  - "session-auth"
  - "polar-checkout"
  - "next-api-routes"
  - "admin-dashboard-layout"
source_projects: 8
confidence_score: 0.96
includes:
  files: 47
  patterns: 5
  stack_config: true
  decision_guide: true
  documentation: true
```

### Export Rules (`marketplace/export-rules.yaml`) — Phase 15

```yaml
rules:
  always_exclude:
    - "*.env"
    - "**/credentials/**"
    - "**/.hive/integrations/**"
    - "**/.hive/business/**"
  sanitize:
    - pattern: "api_key|secret|password|token"
      action: "replace_with_placeholder"
  include_only_verified: true
  minimum_confidence: 0.8
  minimum_usage: 3
```

### Mesh Identity (`mesh/identity.yaml`) — Phase 16

```yaml
peer_id: "hive-dk-7f3a9b"
display_name: "Dakota"
public_key: "ed25519:..."
specialties:
  - "saas-development"
  - "next.js"
  - "drizzle-orm"
  - "enterprise-dxp"
  - "auth-systems"
reputation:
  score: 94
  patterns_shared: 23
  patterns_adopted: 156
  anti_patterns_contributed: 8
  delegations_completed: 12
  delegations_failed: 0
joined: "2026-07-01"
```

### Mesh Peer (`mesh/peers/{peer_id}.yaml`) — Phase 16

```yaml
peer_id: "hive-mx-2e8c1d"
display_name: "Alex"
specialties: ["infrastructure", "devops", "kubernetes", "rust"]
reputation_score: 87
patterns_from_them: 5
patterns_to_them: 3
last_interaction: "2026-08-15"
trust_level: "verified"        # unknown | known | verified | trusted
```

### Shared Pattern (`mesh/shared/outbound/patterns/{slug}.yaml`) — Phase 16

```yaml
original_slug: "session-auth"
shared_as: "mesh-session-auth-dk7f"
shared_date: "2026-07-15"
version: "1.3.0"
metadata:
  description: "Session-based auth with secure cookie handling"
  tags: ["auth", "session", "cookies", "typescript"]
  stack: ["typescript", "node"]
  confidence_score: 0.96
  used_in_projects: 12                  # number only, not project names
  # NO actual code shared — only structure, interface, and usage notes
  structure:
    files: ["auth/session.ts", "auth/middleware.ts", "auth/types.ts"]
    exports: ["createSession", "validateSession", "destroySession", "authMiddleware"]
    dependencies: ["iron-session"]
  usage_notes: "Always set secure: true and httpOnly: true on cookies"
  gotchas: ["Don't store sensitive data in the session object — only the user ID"]
mesh_stats:
  adoptions: 34
  rating: 4.8
  reports: 0
```

### A2A Delegation (`mesh/delegations/{id}.yaml`) — Phase 16

```yaml
id: "del-001"
type: "outbound"               # outbound | inbound
status: "completed"            # pending | accepted | in_progress | completed | failed | rejected
created: "2026-08-10"
protocol: "a2a"
request:
  description: "Need a Dockerfile pattern for a Next.js app with Drizzle + SQLite"
  required_specialties: ["docker", "next.js"]
  budget_tokens: 50000
  deadline: "2026-08-12"
assigned_to: "hive-mx-2e8c1d"
result:
  pattern_received: true
  pattern_slug: "mesh-nextjs-docker-mx2e"
  quality_rating: 5
  adopted: true
cost:
  tokens_used: 12000
  reciprocity: "pattern_exchange"
```

### Mesh Privacy & Security Model — Phase 16

```
NEVER SHARED:
  - Source code (only structure: file names, exports, interfaces)
  - Project names or slugs
  - Client information
  - Business data (revenue, expenses, invoices)
  - API keys, secrets, credentials
  - Personal data

SHARED (opt-in):
  - Pattern structure (file names, export signatures, dependency lists)
  - Pattern metadata (tags, stack, usage count, confidence score)
  - Anti-patterns (full description, workaround, affected stack)
  - Stack satisfaction benchmarks (anonymous aggregates)
  - Usage notes and gotchas

ANONYMIZATION:
  - All project references replaced with generic identifiers
  - Code content replaced with structural descriptions
  - Timestamps randomized within a week range
  - Peer identities are pseudonymous (public key based)
```

---

## Phase 11-16 Tool Definitions

### Self-Replication Tools (Phase 11)

#### `hive_self_audit`
Analyze Hive's own effectiveness and generate improvement proposals.

```
Input:
  period?: string              — "last_week" | "last_month" | "all_time" (default: last_month)
  focus?: string               — "unused_tools" | "slow_tools" | "error_patterns" | "gaps" | "all"

Output:
  {
    period: { start: string, end: string },
    total_calls: number,
    tool_usage: [
      { tool: string, calls: number, avg_duration_ms: number, 
        used_pct: number, ignored_pct: number, error_pct: number }
    ],
    unused_tools: string[],
    slow_tools: [
      { tool: string, avg_ms: number, p95_ms: number }
    ],
    repeated_manual_patterns: [
      { description: string, frequency: number, suggested_tool: string }
    ],
    proposals_generated: number,
    health_score: number                     — 0-100 overall Hive effectiveness
  }
```

**MCP Apps UI:** Dashboard with tool usage heatmap (rows = tools, columns = days, color = call frequency). Unused tools highlighted in red. Slow tools with flame icon. "Repeated patterns" section with "Create Tool" buttons. Overall health score as a gauge.

#### `hive_propose_tool`
Generate a detailed proposal for a new or modified tool.

```
Input:
  type: "new_tool" | "refactor_tool" | "remove_tool" | "schema_change" | "ui_change"
  target?: string              — existing tool name (for refactor/remove)
  description?: string         — what should change and why (optional — auto-generates from telemetry)

Output:
  {
    proposal_id: string,
    type: string,
    proposal: {
      name: string,
      description: string,
      reasoning: string,
      input_schema: object,
      output: string,
      implementation_plan: string[],
      estimated_effort: string,
      affected_tools: string[],
      affected_ui: string[]
    },
    evidence: object
  }
```

**MCP Apps UI:** Proposal card with full spec preview. Side-by-side "before/after" for refactors. Evidence section showing telemetry charts. "Approve", "Reject", "Modify" buttons.

#### `hive_evolve`
Execute an approved proposal — generate code, apply changes, create rollback point.

```
Input:
  proposal_id: string
  dry_run?: boolean

Output:
  {
    evolution_id: string,
    files_changed: string[],
    rollback_version: string,
    tests_passed: boolean,
    status: "applied" | "dry_run"
  }
```

**MCP Apps UI:** Diff view showing all file changes. "Apply" / "Rollback" buttons. Test results panel. Evolution history timeline.

#### `hive_rollback_evolution`
Roll back a specific evolution to its previous state.

```
Input:
  evolution_id: string

Output:
  {
    rolled_back: boolean,
    files_restored: string[],
    current_version: string
  }
```

#### `hive_evolution_history`
View the history of all self-modifications.

```
Input:
  limit?: number               — default 20

Output:
  Evolution log entries with status, files changed, and outcomes
```

**MCP Apps UI:** Timeline visualization. Each evolution as a node with expand for details. Active in green, rolled-back in red.

### Revenue Tools (Phase 12)

#### `hive_revenue_dashboard`
Full fleet revenue overview with trends and breakdowns.

```
Input:
  period?: string              — "today" | "this_week" | "this_month" | "this_quarter" | "this_year"
  compare_to?: string          — "previous_period" | "same_period_last_year"

Output:
  {
    period: { start: string, end: string },
    total_mrr: number,
    total_arr: number,
    total_customers: number,
    mrr_change: number,
    mrr_change_pct: number,
    products: [
      {
        project: string,
        mrr: number,
        customers: number,
        churn_rate: number,
        ltv: number,
        trend: string,
        growth_rate: number,
        plan_breakdown: Record<string, number>,
        contribution_pct: number
      }
    ],
    top_growing: string[],
    needs_attention: [
      { project: string, reason: string }
    ],
    revenue_by_day: Array<{ date: string, mrr: number }>
  }
```

**MCP Apps UI:** Hero number: total MRR with trend arrow. Revenue chart (line graph, daily MRR). Product breakdown table sortable by any column. "Needs Attention" alerts. Contribution pie chart.

#### `hive_pricing_analysis`
Analyze pricing for a specific product and recommend changes.

```
Input:
  project: string

Output:
  {
    current_pricing: {
      plans: Array<{ name: string, price: number, interval: string, customers: number }>,
      average_revenue_per_user: number,
      price_sensitivity_signals: string[]
    },
    recommendations: [
      {
        type: "raise_price" | "lower_price" | "add_tier" | "remove_tier" | "change_limits",
        target: string,
        current: string,
        proposed: string,
        reasoning: string,
        estimated_impact: {
          mrr_change: number,
          customer_change: number,
          confidence: "high" | "medium" | "low"
        }
      }
    ],
    competitor_context: string[],
    similar_products_pricing: [
      { project: string, price: number, customers: number }
    ]
  }
```

**MCP Apps UI:** Current pricing cards. Recommendations as action cards with "estimated impact" mini-charts. "Run Experiment" button.

#### `hive_growth_signals`
Detect which products are gaining/losing traction and why.

```
Input:
  threshold?: number           — minimum growth_rate change to flag (default: 5%)

Output:
  {
    accelerating: [
      { project: string, growth_rate: number, signals: string[] }
    ],
    decelerating: [
      { project: string, growth_rate: number, signals: string[] }
    ],
    stable: [
      { project: string, growth_rate: number }
    ],
    recommendations: [
      { project: string, action: string, reasoning: string, priority: "high" | "medium" | "low" }
    ]
  }
```

**MCP Apps UI:** Three-column layout: Accelerating (green), Decelerating (red), Stable (gray). Recommendations as actionable cards.

#### `hive_run_experiment`
Set up and manage an A/B test for pricing, landing pages, or feature flags.

```
Input:
  project: string
  type: "pricing" | "landing_page" | "feature_flag"
  hypothesis: string
  variants: Array<{ name: string, description: string, traffic_pct: number }>
  duration_days: number

Output:
  {
    experiment_id: string,
    status: "created",
    started: string,
    ends: string,
    tracking_instructions: string[]
  }
```

**MCP Apps UI:** Experiment builder form. Live results dashboard with conversion bars, confidence meter, "Call Winner" button.

#### `hive_financial_summary`
Total business health across all revenue streams.

```
Input:
  period?: string              — "this_month" | "this_quarter" | "this_year" | "all_time"

Output:
  {
    revenue: { total: number, recurring: number, one_time: number },
    expenses: { total: number, hosting: number, apis: number, domains: number, tools: number },
    profit: number,
    margin_pct: number,
    runway_months: number,
    revenue_per_product: Record<string, number>,
    cost_per_product: Record<string, number>,
    most_profitable: string,
    least_profitable: string,
    recommendations: string[]
  }
```

**MCP Apps UI:** P&L summary card. Revenue vs expenses bar chart. Product profitability table. Runway meter.

### Content & Marketing Tools (Phase 13)

#### `hive_generate_launch`
Generate a complete launch package for a product.

```
Input:
  project: string
  channels?: string[]          — "landing_page" | "readme" | "tweets" | "product_hunt" | "email" | "all"
  tone?: string                — "technical" | "casual" | "professional"

Output:
  {
    project: string,
    assets_generated: string[],
    landing_page: {
      html: string,
      sections: Array<{ type: string, content: string, source_component?: string }>
    },
    readme: string,
    tweets: Array<{ type: string, posts: string[] }>,
    product_hunt: { tagline: string, description: string, first_comment: string },
    email_sequences: Record<string, Array<{ day: number, subject: string, body: string }>>,
    changelog: string
  }
```

**MCP Apps UI:** Tabbed preview: Landing Page, README, Tweets, Product Hunt, Emails. Each tab has "Edit", "Approve", "Publish" buttons. Source attribution badges.

#### `hive_generate_content`
Generate SEO content, tutorials, or documentation from the actual codebase.

```
Input:
  project: string
  type: "blog_post" | "tutorial" | "documentation" | "comparison" | "case_study"
  topic?: string
  target_keywords?: string[]

Output:
  {
    title: string,
    content: string,
    meta: { description: string, keywords: string[], estimated_word_count: number, reading_time_minutes: number },
    code_examples: Array<{ description: string, code: string, source_file: string }>,
    internal_links: string[],
    suggested_publish_date: string
  }
```

**MCP Apps UI:** Full article preview. SEO panel. Code examples with "from: {source_file}" badges. "Publish to {CMS}" button.

#### `hive_marketing_dashboard`
Overview of all marketing content performance across products.

```
Input:
  period?: string              — "this_week" | "this_month" | "this_quarter"
  project?: string

Output:
  {
    period: { start: string, end: string },
    total_content_pieces: number,
    total_impressions: number,
    total_clicks: number,
    total_conversions: number,
    total_revenue_attributed: number,
    best_performing: Array<{ content_id: string, project: string, type: string, metric: string, value: number }>,
    underperforming: Array<{ content_id: string, project: string, type: string, issue: string }>,
    content_gaps: Array<{ project: string, days_since_last_content: number, suggested_content: string[] }>,
    messaging_insights: { top_converting_angles: string[], top_channels: string[] }
  }
```

**MCP Apps UI:** Performance table with sparklines. Content gaps as alert cards with "Generate Now" buttons. Messaging insights section.

#### `hive_draft_campaign`
Create a multi-channel campaign from a single brief.

```
Input:
  project: string
  brief: string
  channels: string[]           — "email" | "twitter" | "blog" | "landing_page"
  duration_days?: number

Output:
  {
    campaign_id: string,
    brief: string,
    timeline: Array<{ day: number, channel: string, content_type: string, content: string, scheduled_time?: string }>,
    total_pieces: number,
    estimated_reach: number,
    tracking_setup: string[]
  }
```

**MCP Apps UI:** Campaign timeline (Gantt-like). Content cards on timeline. "Schedule All" button.

#### `hive_auto_changelog`
Generate changelog entries from git history, decision log, and architecture changes.

```
Input:
  project: string
  since?: string               — date or git ref
  format?: "keep-a-changelog" | "conventional" | "narrative"

Output:
  {
    entries: Array<{
      version: string,
      date: string,
      categories: { added: string[], changed: string[], fixed: string[], removed: string[] },
      highlights: string,
      source_commits: string[],
      source_decisions: string[]
    }>
  }
```

**MCP Apps UI:** Changelog preview. Entries linked to source commits/decisions. "Publish" buttons.

### Business Operations Tools (Phase 14)

#### `hive_generate_invoice`
Create an invoice from client and project context.

```
Input:
  client: string
  project?: string
  line_items?: Array<{ description: string, quantity: number, rate: number }>
  period?: string              — "this_month" | "last_month" | custom date range

Output:
  {
    invoice_id: string,
    client: string,
    line_items: Array<{ description: string, quantity: number, rate: number, amount: number }>,
    subtotal: number,
    tax: number,
    total: number,
    pdf_path: string,
    payment_link?: string,
    status: "draft"
  }
```

**MCP Apps UI:** Invoice preview. Line item editor. "Send" button (PDF + email). Payment status tracker.

#### `hive_financial_report`
Generate a tax-ready financial summary for a period.

```
Input:
  period: "this_quarter" | "this_year" | "last_year" | "custom"
  start?: string
  end?: string
  format?: "summary" | "detailed" | "tax_ready"

Output:
  {
    period: { start: string, end: string },
    revenue: {
      total: number,
      by_type: { recurring: number, one_time: number, consulting: number },
      by_project: Record<string, number>,
      by_client: Record<string, number>,
      by_month: Array<{ month: string, amount: number }>
    },
    expenses: {
      total: number,
      by_category: Record<string, number>,
      by_vendor: Record<string, number>,
      by_month: Array<{ month: string, amount: number }>
    },
    profit: { net: number, margin_pct: number, by_month: Array<{ month: string, amount: number }> },
    tax_estimates: {
      estimated_liability: number,
      quarterly_payment_due: number,
      deductible_expenses: number,
      notes: string[]
    },
    outstanding: {
      invoices_unpaid: number,
      amount_outstanding: number,
      overdue: Array<{ invoice_id: string, client: string, amount: number, days_overdue: number }>
    }
  }
```

**MCP Apps UI:** P&L statement. Revenue/expense charts by month. Tax estimate card. Outstanding invoices alerts. "Export to CSV" / "Send to Accountant" buttons.

#### `hive_generate_contract`
Generate a contract from templates + business context.

```
Input:
  type: "freelance" | "saas_terms" | "privacy_policy" | "terms_of_service" | "nda"
  client?: string
  project?: string
  customizations?: Record<string, string>

Output:
  {
    contract_id: string,
    type: string,
    content: string,
    variables_used: Record<string, string>,
    review_notes: string[],
    pdf_path: string
  }
```

**MCP Apps UI:** Contract preview with highlighted auto-filled variables. Review notes as callouts. "Download PDF" / "Send for Signature" buttons.

#### `hive_compliance_scan`
Check all products for legal/compliance gaps.

```
Input:
  project?: string             — specific project, or scan all

Output:
  {
    scanned: number,
    issues: Array<{
      project: string,
      type: "missing_privacy_policy" | "outdated_terms" | "no_cookie_consent" | 
            "missing_gdpr_controls" | "no_contact_info" | "missing_accessibility",
      severity: "critical" | "warning" | "info",
      description: string,
      fix: string,
      auto_fixable: boolean
    }>,
    compliant: string[],
    last_scan: string
  }
```

**MCP Apps UI:** Compliance grid: projects × categories. Green/red per cell. "Auto-Fix" buttons. Overall compliance score.

#### `hive_track_expense`
Log an expense and categorize it.

```
Input:
  vendor: string
  amount: number
  category: "hosting" | "apis" | "domains" | "tools" | "hardware" | "travel" | "other"
  project?: string
  recurring?: boolean
  note?: string

Output:
  { logged: true, monthly_total: number, category_total: number }
```

#### `hive_client_overview`
View all clients with billing status.

```
Input:
  status?: "active" | "inactive" | "all"

Output:
  {
    clients: Array<{
      name: string, slug: string, type: string,
      active_projects: number, total_invoiced: number,
      outstanding: number, overdue: number,
      last_invoice: string, contract_status: "active" | "expired" | "none"
    }>
  }
```

**MCP Apps UI:** Client table with status indicators. Expand for details. "Create Invoice" button per client.

### Knowledge Marketplace Tools (Phase 15)

#### `hive_package_pattern`
Bundle patterns into a distributable package.

```
Input:
  patterns: string[]
  name: string
  description: string
  pricing: { type: "one_time" | "subscription" | "pay_what_you_want" | "free", price?: number, currency?: string }
  include_docs?: boolean
  include_decision_guide?: boolean

Output:
  {
    package_slug: string,
    manifest: object,
    files_included: number,
    files_sanitized: number,
    files_excluded: number,
    preview: { description: string, file_tree: string[], pattern_names: string[], confidence_scores: Record<string, number> },
    warnings: string[],
    ready_to_publish: boolean
  }
```

**MCP Apps UI:** Package builder wizard. File tree with sanitization indicators. Confidence scores. "Publish" button.

#### `hive_package_stack`
Bundle a full stack preset as a product.

```
Input:
  stack: string
  name: string
  description: string
  pricing: object
  extras?: { include_patterns: boolean, include_example_project: boolean, include_docs: boolean }

Output:
  {
    package_slug: string,
    manifest: object,
    stack_config: object,
    patterns_included: string[],
    example_project: { files: number, runs: boolean },
    documentation: { setup_guide: string, architecture_overview: string, decision_rationale: string },
    ready_to_publish: boolean
  }
```

**MCP Apps UI:** Stack overview card. Included patterns gallery. Example project file tree. "Test Build" button.

#### `hive_marketplace_dashboard`
Overview of all marketplace listings and revenue.

```
Input:
  period?: string

Output:
  {
    total_packages: number,
    total_downloads: number,
    total_revenue: number,
    packages: Array<{
      slug: string, name: string, type: string, price: number,
      downloads: number, revenue: number, rating: number,
      trend: "growing" | "stable" | "declining", last_updated: string
    }>,
    top_performing: string[],
    needs_update: Array<{ slug: string, reason: string }>,
    revenue_by_month: Array<{ month: string, amount: number }>,
    customer_insights: { top_tags_requested: string[], frequent_questions: string[], suggested_new_packages: string[] }
  }
```

**MCP Apps UI:** Revenue chart. Package table. "Needs Update" alerts. Customer insights panel. "Create New Package" button.

#### `hive_export_knowledge`
Selective knowledge export for clients, collaborators, or custom use.

```
Input:
  scope: { projects?: string[], patterns?: string[], stacks?: string[], tags?: string[], all?: boolean }
  format: "hive_import" | "markdown" | "json" | "zip"
  sanitize: boolean
  recipient?: "client" | "collaborator" | "public"

Output:
  {
    exported: { patterns: number, stacks: number, decisions: number, dependencies: number },
    file_path: string,
    sanitization_report: { secrets_removed: number, files_excluded: number, files_modified: number }
  }
```

**MCP Apps UI:** Export wizard: select scope → choose format → review sanitization → export.

### Hive Mesh Tools (Phase 16)

#### `hive_mesh_connect`
Join the Hive mesh network or manage your connection.

```
Input:
  action: "join" | "update_profile" | "status" | "disconnect"
  display_name?: string
  share_preferences?: {
    share_patterns: boolean,
    share_anti_patterns: boolean,
    share_benchmarks: boolean,
    accept_delegations: boolean,
    auto_merge_anti_patterns: boolean
  }

Output:
  {
    peer_id: string,
    status: "connected" | "disconnected",
    peers_discovered: number,
    your_reputation: number,
    specialties_detected: string[],
    settings: object
  }
```

**MCP Apps UI:** Connection status card. Specialty badges. Toggle switches for sharing. Peer count.

#### `hive_mesh_share`
Publish patterns, anti-patterns, or benchmarks to the mesh.

```
Input:
  type: "pattern" | "anti_pattern" | "benchmark"
  source: string
  anonymize?: boolean

Output:
  {
    shared_slug: string,
    type: string,
    anonymized: boolean,
    sanitization_report: { fields_removed: string[], references_stripped: number, code_excluded: boolean },
    mesh_id: string,
    initial_visibility: number
  }
```

**MCP Apps UI:** Share wizard with anonymization preview. "Code is never shared" assurance badge.

#### `hive_mesh_insights`
Get collective intelligence from the mesh relevant to your current work.

```
Input:
  context?: { project?: string, tags?: string[], type?: "patterns" | "anti_patterns" | "benchmarks" | "all" }

Output:
  {
    relevant_patterns: Array<{
      mesh_slug: string, description: string, tags: string[],
      adoptions: number, rating: number, source_peer: string,
      compatible_with_your_stack: boolean
    }>,
    anti_patterns_to_watch: Array<{
      name: string, description: string, affected_stack: string[],
      reporters: number, severity: string, applies_to_you: boolean
    }>,
    stack_benchmarks: Array<{
      stack: string, builders_using: number, satisfaction_score: number,
      common_migration_targets: string[], common_pain_points: string[], common_praise: string[]
    }>,
    recommendations: string[]
  }
```

**MCP Apps UI:** Three-tab layout: Patterns (gallery with "Adopt" buttons), Anti-Patterns (warnings with "affects you" badges), Benchmarks (stack comparison table).

#### `hive_mesh_delegate`
Delegate a task to a specialized Hive instance via A2A.

```
Input:
  description: string
  required_specialties: string[]
  budget_tokens?: number
  deadline?: string
  prefer_peer?: string

Output:
  {
    delegation_id: string,
    status: "searching" | "assigned" | "rejected",
    assigned_to?: { peer_id: string, display_name: string, reputation: number, specialties: string[], estimated_completion: string },
    alternatives?: Array<{ peer_id: string, reputation: number, specialties: string[] }>
  }
```

**MCP Apps UI:** Delegation request form. Progress tracker. Result review with "Adopt Result" / "Reject" and quality rating.

#### `hive_mesh_reputation`
View your reputation and contribution history on the mesh.

```
Input:
  peer_id?: string

Output:
  {
    peer_id: string,
    display_name: string,
    reputation_score: number,
    rank: "newcomer" | "contributor" | "expert" | "authority",
    specialties: string[],
    contributions: {
      patterns_shared: number, adoptions_of_your_patterns: number,
      anti_patterns_contributed: number, delegations_completed: number,
      delegations_failed: number, average_rating_received: number
    },
    history: Array<{ date: string, event: string, reputation_change: number }>
  }
```

**MCP Apps UI:** Reputation profile card with score gauge and rank badge. Activity timeline.

---

## Implementation Plan

### Phase 0 — Discovery (build this first)
- Shared UI framework (theme adapter, reusable components, host context)
- Ideas storage (read/write YAML to ~/.hive/ideas/)
- `hive_capture_idea` + form UI, `hive_evaluate_idea` + scorecard UI
- `hive_list_ideas` + kanban UI, `hive_promote_idea` + confirmation UI

### Phase 1 — Foundation
- Project storage layer (read/write YAML to ~/.hive/projects/)
- `hive_init_project`, `hive_get_architecture` + architecture viewer UI, `hive_update_architecture`
- `hive_register_pattern`, `hive_find_patterns` + pattern gallery UI
- `hive_register_dependency`, `hive_check_dependency` + API surface viewer UI

### Phase 2 — Validation
- `hive_validate_against_spec` + traffic light UI
- `hive_validate_code` + issue list UI
- `hive_log_decision` + decision card UI
- `hive_check_progress` + progress dashboard UI
- `hive_evaluate_feature` + effort/impact quadrant UI

### Phase 3 — Acceleration
- `hive_scaffold_project` with stack presets + stack preview UI
- `hive_add_feature`
- `hive_snapshot_patterns`
- `hive_search_knowledge` + tabbed search results UI

### Phase 4 — Intelligence
- Auto-suggest patterns when starting similar projects
- Detect architecture drift (code no longer matches spec)
- Surface relevant decisions from past projects
- Dependency staleness tracking
- Pattern confidence scoring

### Phase 5 — Cross-Project Intelligence
- Pattern lineage tracking across projects
- Decision graph connecting choices across projects
- Anti-pattern registry
- Project similarity scoring
- `hive_get_insights`, `hive_compare_projects`, `hive_suggest_stack`

### Phase 6 — Autonomous Build Agent + A2A Protocol
- Build planner, task executor, iteration loops
- Session persistence across Claude Code sessions
- **A2A integration** — multi-agent coordination (planning → coding → testing agents)
- `hive_plan_build`, `hive_execute_step`, `hive_review_checkpoint` + visual checkpoint UI
- `hive_resume_build`, `hive_rollback_step`

### Phase 11 — Self-Replicating Hive
- Telemetry layer (instrument all tool calls)
- `hive_self_audit`, `hive_propose_tool`, `hive_evolve` + proposal/diff UIs
- `hive_rollback_evolution`, `hive_evolution_history` + timeline UI
- Versioned rollback snapshots

### Phase 12 — Revenue Engine
- Polar.sh integration (sync revenue data)
- Revenue snapshot storage + experiment tracking
- `hive_revenue_dashboard` + revenue chart UI, `hive_pricing_analysis`
- `hive_growth_signals`, `hive_run_experiment` + experiment builder UI
- `hive_financial_summary` + P&L UI

### Phase 13 — Content & Marketing Engine
- Marketing storage (playbooks, calendars, campaigns, assets)
- Content performance tracking with revenue attribution
- `hive_generate_launch` + tabbed preview UI, `hive_generate_content` + article preview UI
- `hive_marketing_dashboard`, `hive_draft_campaign` + timeline UI
- `hive_auto_changelog`

### Phase 14 — Business Operations
- Business entity, client, invoice, expense, contract storage
- `hive_generate_invoice` + invoice preview UI, `hive_financial_report` + P&L UI
- `hive_generate_contract` + contract preview UI, `hive_compliance_scan` + compliance grid UI
- `hive_track_expense`, `hive_client_overview` + client table UI

### Phase 15 — Knowledge Marketplace
- Package manifest + export rules + sanitization pipeline
- `hive_package_pattern` + package builder wizard, `hive_package_stack`
- `hive_marketplace_dashboard` + revenue/package table UI
- `hive_export_knowledge` + export wizard UI

### Phase 16 — Hive Mesh (Network Effect)
- Mesh identity, peer discovery, reputation system
- Privacy/anonymization layer (code never shared, structure only)
- `hive_mesh_connect`, `hive_mesh_share` + share wizard UI
- `hive_mesh_insights` + three-tab insights UI, `hive_mesh_delegate` + delegation UI
- `hive_mesh_reputation` + reputation profile UI
- A2A delegation protocol

---

## Tech Stack for Hive

- **Runtime:** Node.js / TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **MCP Apps:** `@modelcontextprotocol/ext-apps` — every tool ships with an interactive UI
- **UI Bundling:** Vite + `vite-plugin-singlefile` (bundle UI into single HTML per tool)
- **UI Framework:** Preact or vanilla HTML/CSS/JS (lightweight, fast to build)
- **Storage:** YAML files (via `yaml` package) in `~/.hive/`
- **Search:** Simple tag + keyword matching (Phase 1), embeddings later if needed
- **No database needed** — flat files are fine for personal use and git-friendly

## MCP Apps Strategy

Every Hive tool is designed with two outputs:
1. **Structured content** — JSON/text that Claude can reason about
2. **UI resource** — interactive HTML rendered inside the AI client

The UI is not decorative. It's functional — buttons trigger tool calls, forms submit data, dashboards update in real time.

### UI Components by Tool

**Discovery Tools:**
- `hive_capture_idea` → Structured form: description, problem, audience fields. Submit button calls the tool.
- `hive_evaluate_idea` → Interactive scorecard: feasibility/scope/competitive scores with visual indicators, verdict buttons (Build / Park / Kill), MVP scope editor.
- `hive_list_ideas` → Kanban-style board: columns for raw/evaluated/approved/parked/rejected. Click to expand, drag to change status.
- `hive_promote_idea` → Confirmation card: shows MVP scope, stack recommendation, "Create Project" button.

**Architecture Tools:**
- `hive_get_architecture` → Visual component diagram with data flows. Click components to see details, files, dependencies.
- `hive_update_architecture` → Diff view showing what changed, with approve/reject controls.
- `hive_log_decision` → Decision card with structured fields, auto-linked to component.
- `hive_validate_against_spec` → Traffic light view: green (aligned), yellow (concerns), red (conflicts). Expandable details.
- `hive_check_progress` → Progress dashboard: component bars showing built/in-progress/missing. Overall coverage percentage.
- `hive_evaluate_feature` → Effort/impact quadrant chart. Feature plotted on the grid. Recommendation card with "Build / Defer / Cut / Simplify" actions.

**Knowledge Tools:**
- `hive_register_pattern` → Code preview with syntax highlighting, tag editor, save confirmation.
- `hive_find_patterns` → Pattern gallery: cards with name, tags, usage count. Click to expand full code. "Apply to project" button.
- `hive_register_dependency` → API surface viewer: collapsible exports, signatures, gotchas highlighted.
- `hive_check_dependency` → Quick reference card: key exports, common patterns, gotchas. "Not registered" state with one-click register.
- `hive_validate_code` → Issue list with severity indicators. Each issue expandable with fix suggestion.

**Build Tools:**
- `hive_scaffold_project` → Stack preview: shows what will be created (file tree, dependencies, patterns). "Scaffold" button.
- `hive_search_knowledge` → Search results UI with tabs: Patterns / Dependencies / Decisions / Architectures. Click to drill in.

### UI Architecture

```
src/
  server/
    index.ts              # MCP server entry
    tools/                # Tool handlers (structured content)
    storage/              # YAML read/write layer
  ui/
    shared/
      styles.css          # Shared theme (adapts to host context)
      components.ts       # Reusable UI primitives
    views/
      idea-scorecard/     # Each tool's UI as a mini-app
      architecture-map/
      progress-dashboard/
      pattern-gallery/
      feature-evaluator/
      ...
  build/
    bundle.ts             # Vite config to bundle each view into single HTML
```

Each UI view:
1. Receives `structuredContent` from the tool result (data to display)
2. Renders interactive HTML
3. Can call back to Hive tools via `tools/call` through the host
4. Adapts to host theme (dark/light mode) via `ui/initialize` host context