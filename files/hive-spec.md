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
├── fleet/
│   ├── topology.yaml            # Infrastructure topology (hosts, domains)
│   ├── costs.yaml               # Resource cost registry
│   └── priorities.yaml          # Fleet-level priority scores
├── retrospectives/
│   └── {project-slug}.yaml      # Post-build analysis per project
├── metrics/
│   ├── tool-usage.yaml          # Which Hive tools are used and how often
│   ├── estimates.yaml           # Historical estimate vs actual data
│   └── pattern-health.yaml      # Pattern quality metrics
├── revenue/
│   └── {project-slug}.yaml      # Per-project revenue entries
├── maintenance/
│   ├── schedule.yaml            # Automated maintenance rules
│   └── log.yaml                 # Maintenance action history
└── templates/
    ├── project/                  # Project scaffolding templates
    ├── feature/                  # Feature-level templates
    └── component/                # Component-level templates
```

Per-project additions (inside `projects/{project-slug}/`):
```
├── deploy.yaml                  # Deploy target config + deploy history
├── health.yaml                  # Health check definitions + results
├── errors.yaml                  # Error log with severity
├── usage.yaml                   # Usage metrics and trends
└── backlog.yaml                 # Iteration backlog (bugs, improvements, ideas)
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

### Deploy Config (`projects/{slug}/deploy.yaml`)

```yaml
project: "my-app"
target: "vercel"
command: "vercel --prod"
directory: "/Users/me/projects/my-app"
environment_vars:
  - "DATABASE_URL"
  - "AUTH_SECRET"
pre_deploy:
  - "npm run build"
  - "npm run test"

history:
  - id: "deploy-001"
    date: "2026-03-15T14:30:00Z"
    target: "vercel"
    status: "success"        # success | failed | rolled_back
    duration_seconds: 45
    version: "v1.2.0"
    commit: "abc123f"
    url: "https://my-app.vercel.app"
    notes: "Added auth flow"

  - id: "deploy-002"
    date: "2026-03-16T10:00:00Z"
    target: "vercel"
    status: "failed"
    duration_seconds: 12
    error: "Build failed: type error in auth.ts"
```

### Health Config (`projects/{slug}/health.yaml`)

```yaml
project: "my-app"
checks:
  - name: "api-root"
    type: "http"             # http | command
    url: "https://my-app.vercel.app/api/health"
    method: "GET"
    expected_status: 200
    timeout_ms: 5000

  - name: "db-connection"
    type: "command"
    command: "curl -s https://my-app.vercel.app/api/health/db | jq .status"
    expected_output: "ok"

results:
  - date: "2026-03-16T12:00:00Z"
    checks:
      - name: "api-root"
        status: "green"      # green | yellow | red
        response_ms: 120
      - name: "db-connection"
        status: "green"
        response_ms: 340
    overall: "green"

  - date: "2026-03-15T12:00:00Z"
    checks:
      - name: "api-root"
        status: "red"
        error: "Connection refused"
      - name: "db-connection"
        status: "red"
        error: "Timeout"
    overall: "red"
```

### Error Log (`projects/{slug}/errors.yaml`)

```yaml
project: "my-app"
source_command: "vercel logs my-app --since 24h 2>&1 | grep ERROR"
entries:
  - id: "err-001"
    date: "2026-03-16T09:15:00Z"
    severity: "error"        # warning | error | critical
    message: "TypeError: Cannot read properties of undefined (reading 'email')"
    endpoint: "/api/auth/signup"
    count: 3
    first_seen: "2026-03-16T09:15:00Z"
    last_seen: "2026-03-16T09:45:00Z"
    resolved: false

  - id: "err-002"
    date: "2026-03-15T14:00:00Z"
    severity: "warning"
    message: "Slow query: SELECT * FROM users took 2300ms"
    endpoint: "/api/users"
    count: 12
    first_seen: "2026-03-14T10:00:00Z"
    last_seen: "2026-03-15T14:00:00Z"
    resolved: true
    resolution: "Added index on users.email"
```

### Usage Data (`projects/{slug}/usage.yaml`)

```yaml
project: "my-app"
source_command: "curl -s https://my-app.vercel.app/api/analytics/summary"
entries:
  - date: "2026-03-16"
    requests: 1240
    unique_visitors: 45
    top_endpoints:
      - path: "/api/auth/login"
        count: 320
      - path: "/api/users"
        count: 180
    error_rate: 0.02

  - date: "2026-03-15"
    requests: 980
    unique_visitors: 38
    top_endpoints:
      - path: "/api/auth/login"
        count: 290
      - path: "/api/users"
        count: 150
    error_rate: 0.01

trend:
  direction: "up"            # up | down | flat
  period: "7d"
  change_pct: 15.2
```

### Backlog (`projects/{slug}/backlog.yaml`)

```yaml
project: "my-app"
items:
  - id: "bl-001"
    type: "bug"              # bug | improvement | idea | maintenance
    priority: "high"         # critical | high | medium | low
    title: "Login fails with special characters in password"
    description: "URL encoding issue in auth endpoint"
    source: "error-log"      # error-log | usage | manual | retrospective
    created: "2026-03-16"
    status: "open"           # open | in_progress | done | wont_fix

  - id: "bl-002"
    type: "improvement"
    priority: "medium"
    title: "Add rate limiting to auth endpoints"
    description: "Prevent brute force attempts"
    source: "manual"
    created: "2026-03-15"
    status: "open"

  - id: "bl-003"
    type: "maintenance"
    priority: "low"
    title: "Update drizzle-orm to 0.35.x"
    description: "New version has better SQLite support"
    source: "fleet-scan"
    created: "2026-03-14"
    status: "open"
```

### Fleet Topology (`fleet/topology.yaml`)

```yaml
hosts:
  - name: "vercel-main"
    provider: "vercel"
    type: "serverless"
    projects: ["my-app", "api-service"]
    region: "iad1"

  - name: "hetzner-vps-1"
    provider: "hetzner"
    type: "vps"
    ip: "65.21.x.x"
    projects: ["background-jobs", "monitoring"]
    specs: { cpu: 2, ram: "4GB", disk: "80GB" }

domains:
  - domain: "myapp.com"
    registrar: "cloudflare"
    dns: "cloudflare"
    projects: ["my-app"]
    expires: "2027-03-01"

  - domain: "mytools.dev"
    registrar: "namecheap"
    dns: "cloudflare"
    projects: ["tool-a", "tool-b"]
    expires: "2026-12-15"
```

### Cost Registry (`fleet/costs.yaml`)

```yaml
entries:
  - name: "Vercel Pro"
    category: "hosting"      # hosting | domain | api | database | monitoring | other
    provider: "vercel"
    amount: 20.00
    currency: "USD"
    period: "monthly"
    projects: ["my-app", "api-service"]

  - name: "myapp.com"
    category: "domain"
    provider: "cloudflare"
    amount: 12.00
    currency: "USD"
    period: "yearly"
    projects: ["my-app"]

  - name: "Stripe API"
    category: "api"
    provider: "stripe"
    amount: 0.00
    currency: "USD"
    period: "monthly"
    notes: "Pay-per-use, ~$2/mo at current volume"
    projects: ["my-app"]

totals:
  monthly: 22.00
  yearly: 276.00
  last_updated: "2026-03-16"
```

### Retrospective (`retrospectives/{project-slug}.yaml`)

```yaml
project: "my-app"
completed: "2026-03-16"
build_sessions: 4
total_duration_hours: 12

planning_accuracy:
  planned_components: 6
  actual_components: 7
  scope_change: "+1 (added rate limiting)"
  score: 4                   # 1-5, how close to plan

pattern_reuse:
  patterns_available: 8
  patterns_used: 5
  patterns_modified: 1
  new_patterns_extracted: 2
  reuse_rate: 0.625

knowledge_usage:
  dependencies_preregistered: 4
  dependencies_added: 1
  decisions_from_history: 3
  hallucinations_caught: 2

lessons:
  - "SQLite WAL mode is essential for any concurrent read scenario"
  - "Should have registered the auth pattern earlier — rebuilt it from scratch"
  - "Vercel deploy config should be a pattern, not ad-hoc"

scores:
  speed: 4                   # 1-5
  quality: 4
  knowledge_growth: 5
  overall: 4.3
```

### Pattern Health Entry (`metrics/pattern-health.yaml`)

```yaml
patterns:
  - slug: "drizzle-sqlite-setup"
    total_uses: 8
    recent_uses_30d: 2
    modifications_after_use: 1
    modification_rate: 0.125
    last_used: "2026-03-10"
    staleness: "fresh"       # fresh | aging | stale
    confidence: "high"       # high | medium | low
    notes: "Solid pattern, rarely needs changes"

  - slug: "session-auth"
    total_uses: 5
    recent_uses_30d: 1
    modifications_after_use: 3
    modification_rate: 0.6
    last_used: "2026-03-08"
    staleness: "aging"
    confidence: "medium"
    notes: "Frequently modified — consider splitting into variants"
```

### Estimate Entry (`metrics/estimates.yaml`)

```yaml
estimates:
  - project: "my-app"
    date: "2026-03-01"
    estimated_sessions: 3
    actual_sessions: 4
    estimated_components: 6
    actual_components: 7
    accuracy: 0.78
    similar_projects: ["project-a", "project-b"]
    factors:
      - "Underestimated auth complexity"
      - "Pattern reuse saved time on DB setup"

  - project: "cli-tool"
    date: "2026-02-20"
    estimated_sessions: 2
    actual_sessions: 2
    estimated_components: 4
    actual_components: 4
    accuracy: 1.0
    similar_projects: ["other-cli"]
    factors:
      - "Simple scope, good pattern coverage"
```

### Revenue Data (`revenue/{project-slug}.yaml`)

```yaml
project: "my-app"
model: "subscription"        # subscription | one-time | usage-based | freemium | ad-supported
entries:
  - date: "2026-03"
    amount: 49.00
    currency: "USD"
    customers: 3
    source: "stripe"
    notes: "First paying customers"

  - date: "2026-02"
    amount: 0.00
    currency: "USD"
    customers: 0
    source: "stripe"
    notes: "Pre-launch"

summary:
  mrr: 49.00
  total_revenue: 49.00
  total_customers: 3
  trend: "up"
  last_updated: "2026-03-16"
```

### Maintenance Schedule (`maintenance/schedule.yaml`)

```yaml
rules:
  - id: "maint-001"
    name: "Dependency security scan"
    type: "command"
    command: "npm audit --json"
    schedule: "weekly"
    applies_to: "all"        # all | specific project slugs
    auto_apply: false         # if true, auto-fix when possible
    last_run: "2026-03-14"

  - id: "maint-002"
    name: "Pattern staleness check"
    type: "hive_tool"
    tool: "hive_pattern_health"
    schedule: "monthly"
    applies_to: "all"
    auto_apply: false
    last_run: "2026-03-01"

  - id: "maint-003"
    name: "SSL certificate expiry check"
    type: "command"
    command: "echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -enddate"
    schedule: "weekly"
    applies_to: ["my-app", "api-service"]
    auto_apply: false
    last_run: "2026-03-14"

log:
  - date: "2026-03-14"
    rule: "maint-001"
    result: "2 low-severity vulnerabilities found"
    action_taken: "Added to backlog"
  - date: "2026-03-14"
    rule: "maint-003"
    result: "All certs valid, nearest expiry 2026-09-01"
    action_taken: "None needed"
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

### Product Lifecycle Tools

#### `hive_deploy`
Execute the configured deploy command for a project, record the result.

```
Input:
  project: string            — project slug
  dry_run?: boolean          — if true, show what would run without executing (default: true)
  notes?: string             — deploy notes (e.g., "Added auth flow")

Output:
  {
    deploy_id: string,
    status: "success" | "failed" | "dry_run",
    target: string,
    duration_seconds: number,
    url?: string,
    error?: string,
    command_executed: string
  }

Side effects:
  Runs pre_deploy commands, then deploy command from deploy.yaml
  Appends deploy record to deploy.yaml history
  If dry_run, only shows commands that would execute
```

#### `hive_check_health`
Run health checks for a project and return traffic-light status.

```
Input:
  project: string            — project slug

Output:
  {
    overall: "green" | "yellow" | "red",
    checks: [
      {
        name: string,
        status: "green" | "yellow" | "red",
        response_ms?: number,
        error?: string
      }
    ],
    last_checked: string
  }

Side effects:
  Executes HTTP requests or commands defined in health.yaml
  Appends result to health.yaml results
  Returns "not configured" if no health.yaml exists (with setup instructions)
```

#### `hive_get_errors`
Retrieve and filter recent errors from a running project.

```
Input:
  project: string            — project slug
  severity?: string          — filter: "warning" | "error" | "critical"
  since?: string             — ISO date or relative ("24h", "7d")
  resolved?: boolean         — filter by resolution status

Output:
  {
    entries: ErrorEntry[],
    summary: {
      total: number,
      by_severity: { warning: number, error: number, critical: number },
      unresolved: number
    }
  }

Side effects:
  If source_command is configured, runs it to pull fresh errors first
  Appends new entries to errors.yaml
```

#### `hive_get_usage`
Get usage stats for a project with trend computation.

```
Input:
  project: string            — project slug
  period?: string            — "7d" | "30d" | "90d" (default: "7d")

Output:
  {
    entries: UsageEntry[],
    trend: {
      direction: "up" | "down" | "flat",
      change_pct: number,
      period: string
    },
    summary: {
      avg_daily_requests: number,
      avg_daily_visitors: number,
      avg_error_rate: number
    }
  }

Side effects:
  If source_command is configured, runs it to pull fresh usage data first
  Updates trend in usage.yaml
```

#### `hive_add_to_backlog`
Add a bug, improvement, idea, or maintenance item to a project's backlog.

```
Input:
  project: string
  type: "bug" | "improvement" | "idea" | "maintenance"
  title: string
  description?: string
  priority?: "critical" | "high" | "medium" | "low"   — default: "medium"
  source?: string            — where this came from (e.g., "error-log", "manual")

Output:
  {
    id: string,
    item: BacklogItem
  }

Side effects:
  Appends item to backlog.yaml with auto-incremented ID
  Creates backlog.yaml if it doesn't exist
```

#### `hive_get_backlog`
Query a project's backlog with filters.

```
Input:
  project: string
  type?: string              — filter by type
  priority?: string          — filter by priority
  status?: string            — filter by status (default: "open")

Output:
  {
    items: BacklogItem[],
    summary: {
      total: number,
      by_type: { bug: number, improvement: number, idea: number, maintenance: number },
      by_priority: { critical: number, high: number, medium: number, low: number }
    }
  }
```

#### `hive_archive_project`
Mark a project as archived, preserve all knowledge it generated.

```
Input:
  project: string
  reason?: string            — why you're archiving

Output:
  {
    archived: true,
    knowledge_preserved: {
      patterns_extracted: number,
      decisions_logged: number,
      dependencies_registered: number
    }
  }

Side effects:
  Sets project status to "archived" in architecture.yaml
  Logs archival decision in decisions.yaml
  Knowledge (patterns, deps, decisions) remains in registry — only project is inactive
```

### Fleet Management Tools

#### `hive_fleet_status`
Scan all projects and aggregate health, errors, usage, and costs into a fleet overview.

```
Input:
  include_archived?: boolean  — include archived projects (default: false)

Output:
  {
    projects: [
      {
        name: string,
        status: string,
        health: "green" | "yellow" | "red" | "unknown",
        last_deploy: string | null,
        recent_errors: number,
        usage_trend: "up" | "down" | "flat" | "unknown",
        monthly_cost: number
      }
    ],
    fleet_summary: {
      total_projects: number,
      healthy: number,
      unhealthy: number,
      total_monthly_cost: number,
      total_monthly_revenue: number
    }
  }

Side effects:
  Scans all project directories under ~/.hive/projects/
  Reads each project's health.yaml, errors.yaml, usage.yaml
  Reads fleet/costs.yaml and revenue/ files
  Computed on-demand, no separate fleet database
```

#### `hive_fleet_scan_deps`
Find outdated or vulnerable dependencies across all projects.

```
Input:
  package?: string           — scan for a specific package (default: scan all)
  severity?: string          — minimum vulnerability severity to report

Output:
  {
    outdated: [
      {
        package: string,
        current_version: string,
        latest_version: string,
        projects: string[]
      }
    ],
    vulnerabilities: [
      {
        package: string,
        severity: string,
        advisory: string,
        projects: string[]
      }
    ]
  }

Side effects:
  Reads registered dependencies from knowledge/dependencies/
  Cross-references with project architecture files
  Does NOT run npm audit — reads from Hive's own registry
```

#### `hive_fleet_update_pattern`
Propagate a pattern change to all projects that use it.

```
Input:
  pattern: string            — pattern slug
  dry_run?: boolean          — if true, show affected projects without modifying (default: true)

Output:
  {
    pattern: string,
    affected_projects: [
      {
        project: string,
        files_to_update: string[],
        diff_preview: string
      }
    ],
    applied: boolean          — false if dry_run
  }

Side effects:
  If not dry_run, updates pattern files in each affected project
  Logs the update in each project's decisions.yaml
  Dry-run by default — always show before modifying
```

#### `hive_fleet_costs`
Get cost breakdown across the fleet by project, category, or provider.

```
Input:
  group_by?: "project" | "category" | "provider"   — default: "project"

Output:
  {
    breakdown: [
      {
        name: string,
        monthly: number,
        yearly: number,
        items: CostEntry[]
      }
    ],
    totals: {
      monthly: number,
      yearly: number
    },
    vs_revenue: {
      monthly_cost: number,
      monthly_revenue: number,
      net: number
    }
  }
```

#### `hive_whats_next`
Priority-scored recommendations for what to work on, based on health, errors, usage, backlog, and revenue.

```
Input:
  available_time?: "quick" | "session" | "deep"   — how much time you have (default: "session")
  focus?: string             — optional focus area (e.g., "bugs", "growth", "maintenance")

Output:
  {
    recommendations: [
      {
        project: string,
        action: string,
        reason: string,
        priority_score: number,     — 0-100, weighted by urgency/impact
        estimated_effort: "trivial" | "small" | "medium" | "large",
        source: string              — what signal triggered this (error, usage drop, etc.)
      }
    ]
  }

Side effects:
  Scans all projects' backlogs, errors, health, usage
  Scores using: critical errors > high backlog items > usage trends > maintenance > improvements
  Filters by available_time (quick = trivial/small tasks only)
```

### Self-Improving Hive Tools

#### `hive_retrospective`
Analyze a completed project build: planning accuracy, pattern reuse, lessons learned.

```
Input:
  project: string            — project slug

Output:
  {
    build_sessions: number,
    planning_accuracy: {
      planned_components: number,
      actual_components: number,
      scope_change: string,
      score: number              — 1-5
    },
    pattern_reuse: {
      patterns_available: number,
      patterns_used: number,
      patterns_modified: number,
      new_patterns_extracted: number,
      reuse_rate: number
    },
    knowledge_usage: {
      dependencies_preregistered: number,
      dependencies_added: number,
      decisions_from_history: number,
      hallucinations_caught: number
    },
    lessons: string[],
    scores: {
      speed: number,
      quality: number,
      knowledge_growth: number,
      overall: number
    }
  }

Side effects:
  Reads project's architecture, decisions, patterns used
  Compares initial plan vs final state
  Saves retrospective to ~/.hive/retrospectives/{project}.yaml
```

#### `hive_knowledge_gaps`
Find unregistered patterns, dependencies, and anti-patterns in your knowledge base.

```
Input:
  scope?: "all" | string     — "all" or a specific project slug (default: "all")

Output:
  {
    unregistered_patterns: [
      {
        description: string,
        evidence: string[],         — projects where this appears
        suggested_name: string
      }
    ],
    unregistered_dependencies: [
      {
        name: string,
        used_in: string[],
        has_surface: boolean
      }
    ],
    potential_antipatterns: [
      {
        description: string,
        evidence: string[],
        suggestion: string
      }
    ]
  }

Side effects:
  Scans all project architectures and decisions
  Cross-references with registered patterns and dependencies
  Identifies repeated code/decisions that aren't captured as patterns
```

#### `hive_pattern_health`
Score pattern quality: usage rate, modification rate, staleness.

```
Input:
  pattern?: string           — specific pattern slug, or all if omitted

Output:
  {
    patterns: [
      {
        slug: string,
        total_uses: number,
        recent_uses_30d: number,
        modification_rate: number,
        staleness: "fresh" | "aging" | "stale",
        confidence: "high" | "medium" | "low",
        recommendation: string       — e.g., "Consider splitting into variants"
      }
    ],
    summary: {
      total: number,
      fresh: number,
      aging: number,
      stale: number,
      avg_confidence: string
    }
  }

Side effects:
  Reads pattern usage data from all projects
  Updates metrics/pattern-health.yaml
```

#### `hive_estimate`
Predict effort for a project based on similar past projects.

```
Input:
  description: string        — what you're planning to build
  components?: number        — estimated component count
  stack?: string             — stack preset slug

Output:
  {
    estimated_sessions: number,
    confidence: "high" | "medium" | "low",
    similar_projects: [
      {
        project: string,
        similarity: number,         — 0-1
        actual_sessions: number,
        components: number
      }
    ],
    factors: {
      pattern_coverage: number,     — % of likely needs covered by existing patterns
      stack_familiarity: number,    — 0-1, how well you know this stack
      scope_complexity: string      — "simple" | "moderate" | "complex"
    },
    historical_accuracy: number     — avg accuracy of past estimates
  }

Side effects:
  Reads metrics/estimates.yaml for historical data
  Compares against all past project architectures
```

### Sovereign Builder OS Tools

#### `hive_idea_pipeline`
Auto-score all raw ideas against current capabilities, patterns, and available time.

```
Input:
  filter?: "raw" | "evaluated" | "all"   — which ideas to score (default: "raw")

Output:
  {
    ideas: [
      {
        slug: string,
        name: string,
        capability_score: number,    — 0-100, how much of this you can build with existing knowledge
        pattern_coverage: number,    — % of likely needs covered
        estimated_sessions: number,
        priority_score: number,      — 0-100, weighted by feasibility + impact + effort
        recommendation: "build next" | "build soon" | "park" | "needs evaluation"
      }
    ]
  }

Side effects:
  Reads all ideas from ~/.hive/ideas/
  Cross-references with patterns, stacks, past projects
  Does NOT modify ideas — read-only scoring
```

#### `hive_track_revenue`
Add or query revenue data for a project.

```
Input:
  project: string
  action: "add" | "query"
  entry?: {                    — required if action is "add"
    date: string,              — month (e.g., "2026-03")
    amount: number,
    currency?: string,         — default: "USD"
    customers?: number,
    source?: string,
    notes?: string
  }
  period?: string              — for query: "3m" | "6m" | "12m" | "all" (default: "all")

Output:
  {
    entries: RevenueEntry[],
    summary: {
      mrr: number,
      total_revenue: number,
      total_customers: number,
      trend: "up" | "down" | "flat"
    }
  }

Side effects:
  If action is "add", appends entry to revenue/{project}.yaml
  Updates summary calculations
```

#### `hive_fleet_revenue`
Cross-fleet revenue vs cost dashboard.

```
Input:
  period?: string              — "3m" | "6m" | "12m" | "all" (default: "all")

Output:
  {
    projects: [
      {
        name: string,
        mrr: number,
        monthly_cost: number,
        net: number,
        customers: number,
        trend: "up" | "down" | "flat"
      }
    ],
    fleet_totals: {
      total_mrr: number,
      total_monthly_cost: number,
      total_net: number,
      total_customers: number,
      profitable_projects: number,
      unprofitable_projects: number
    }
  }

Side effects:
  Reads all revenue/ files and fleet/costs.yaml
  Computed on-demand, no separate database
```

#### `hive_maintenance_run`
Execute maintenance rules from the schedule (dry-run by default).

```
Input:
  rule?: string              — specific rule ID, or all if omitted
  dry_run?: boolean          — if true, show what would run (default: true)

Output:
  {
    results: [
      {
        rule_id: string,
        name: string,
        status: "ok" | "action_needed" | "failed" | "dry_run",
        output: string,
        action_taken?: string,
        projects_affected: string[]
      }
    ]
  }

Side effects:
  If not dry_run, executes commands from maintenance/schedule.yaml
  Appends results to maintenance/log.yaml
  May add items to project backlogs if issues found
  Dry-run by default — always preview before executing
```

#### `hive_build_from_description`
Natural language description to full orchestrated build pipeline (idea → evaluate → plan → build).

```
Input:
  description: string        — natural language description of what to build
  auto_approve?: boolean     — if true, skip checkpoints (default: false)

Output:
  {
    pipeline: {
      idea: { slug: string, evaluation: object },
      project: { slug: string, architecture: object },
      build_plan: { phases: number, steps: number },
      status: "ready" | "awaiting_approval" | "building" | "complete"
    },
    next_action: string       — what happens next / what needs approval
  }

Side effects:
  Orchestrates existing tools in sequence:
    1. hive_capture_idea (structures the description)
    2. hive_evaluate_idea (feasibility check)
    3. hive_promote_idea (creates project)
    4. hive_plan_build (generates build plan)
    5. hive_execute_step (if auto_approve, begins building)
  Each step can pause for approval if auto_approve is false
  This is orchestration, not new capability — composes existing tools
```

#### `hive_export_knowledge`
Export patterns, dependencies, and decisions as a portable bundle.

```
Input:
  scope?: "all" | string[]   — "all" or specific categories: ["patterns", "dependencies", "decisions", "stacks"]
  format?: "yaml" | "json"   — output format (default: "yaml")
  output_path?: string       — where to write the bundle (default: ~/.hive/exports/)

Output:
  {
    exported: {
      patterns: number,
      dependencies: number,
      decisions: number,
      stacks: number,
      antipatterns: number
    },
    path: string,
    size_kb: number
  }

Side effects:
  Creates a portable bundle file at output_path
  Bundle includes all selected knowledge with metadata
  Can be imported into another Hive instance
```

#### `hive_autonomy_status`
View and control full-autonomy build sessions.

```
Input:
  action: "status" | "approve" | "reject" | "pause" | "resume"
  session_id?: string        — required for approve/reject/pause/resume

Output:
  {
    sessions: [
      {
        id: string,
        project: string,
        status: "running" | "paused" | "awaiting_approval" | "complete" | "failed",
        current_step: string,
        progress: { completed: number, total: number },
        pending_approval?: {
          action: string,
          description: string,
          risk_level: "low" | "medium" | "high"
        }
      }
    ]
  }

Side effects:
  If action is "approve", resumes the paused session
  If action is "reject", rolls back pending action and pauses
  If action is "pause", pauses a running session at next safe point
  If action is "resume", continues a paused session
  All session state stored in project's build session files
```

---

## External Integration Design

Hive uses a **recipe pattern** for all external integrations — it stores configuration, not SDKs.

### Principles

1. **Config is YAML** — deploy commands, health check URLs, error source commands, maintenance scripts are all stored as YAML configuration in the project or fleet directories.

2. **Execution is shell commands** — Hive runs whatever command you configured. `vercel --prod`, `docker compose up -d`, `ssh deploy@server ./deploy.sh` — it doesn't care. This makes Hive deploy-target agnostic.

3. **Data ingestion is pull-based** — there's no daemon running. When you ask Hive for errors or usage data, it runs the configured source command at that moment. This keeps Hive simple and stateless between sessions.

4. **Graceful degradation** — every tool works with zero configuration. If you call `hive_check_health` on a project with no `health.yaml`, it returns a helpful message explaining how to set it up, not an error. Tools are always safe to call.

### Example: Deploy Recipe

```yaml
# In projects/my-app/deploy.yaml
target: "vercel"
command: "vercel --prod"
directory: "/Users/me/projects/my-app"
pre_deploy:
  - "npm run build"
  - "npm run test"
```

Hive doesn't know what Vercel is. It just runs `npm run build`, then `npm run test`, then `vercel --prod` in the configured directory. Swap "vercel" for "docker compose up -d" and Hive works exactly the same way.

### Example: Error Source Recipe

```yaml
# In projects/my-app/errors.yaml
source_command: "vercel logs my-app --since 24h 2>&1 | grep ERROR"
```

Hive runs this command, parses the output, and stores structured error entries. The user controls what "errors" means for their project.

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

### Phase 7 — Product Lifecycle (7 tools, 1 type file, per-project YAML additions)
- `hive_deploy` — execute configured deploy, record result + deploy history UI
- `hive_check_health` — HTTP/command health checks + traffic-light dashboard UI
- `hive_get_errors` — retrieve/filter errors + error list UI with severity indicators
- `hive_get_usage` — usage stats with trends + usage chart UI
- `hive_add_to_backlog` — log bug/improvement/idea/maintenance + backlog form UI
- `hive_get_backlog` — filterable backlog query + kanban backlog UI
- `hive_archive_project` — set status to archived, preserve knowledge + archive confirmation UI
- New per-project files: `deploy.yaml`, `health.yaml`, `errors.yaml`, `usage.yaml`, `backlog.yaml`

### Phase 8 — Fleet Management (5 tools, 1 type file, fleet/ directory)
- `hive_fleet_status` — scan all projects, aggregate overview + fleet dashboard UI
- `hive_fleet_scan_deps` — find outdated deps across fleet + vulnerability table UI
- `hive_fleet_update_pattern` — propagate pattern changes (dry-run default) + diff preview UI
- `hive_fleet_costs` — cost breakdown by project/category/provider + cost chart UI
- `hive_whats_next` — priority-scored recommendations + priority queue UI
- New directory: `~/.hive/fleet/` with `topology.yaml`, `costs.yaml`, `priorities.yaml`

### Phase 9 — Self-Improving Hive (4 tools, 1 type file, retrospectives/ + metrics/)
- `hive_retrospective` — analyze build accuracy, pattern reuse, lessons + retrospective scorecard UI
- `hive_knowledge_gaps` — find unregistered patterns/deps/antipatterns + gap list UI
- `hive_pattern_health` — usage rate, modification rate, staleness scoring + pattern health dashboard UI
- `hive_estimate` — predict effort from similar past projects + estimate breakdown UI
- New directories: `~/.hive/retrospectives/`, `~/.hive/metrics/`

### Phase 10 — Sovereign Builder OS (7 tools, 1 type file, revenue/ + maintenance/)
- `hive_idea_pipeline` — auto-score all ideas against capabilities + pipeline board UI
- `hive_track_revenue` — add/query revenue per project + revenue chart UI
- `hive_fleet_revenue` — cross-fleet revenue vs cost dashboard + P&L dashboard UI
- `hive_maintenance_run` — execute maintenance rules (dry-run default) + maintenance log UI
- `hive_build_from_description` — NL description → full build pipeline + pipeline wizard UI
- `hive_export_knowledge` — export portable knowledge bundle + export preview UI
- `hive_autonomy_status` — control autonomy sessions + session control panel UI
- New directories: `~/.hive/revenue/`, `~/.hive/maintenance/`

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