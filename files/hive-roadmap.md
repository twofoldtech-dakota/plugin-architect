# Hive — Full Roadmap

> From knowledge layer → autonomous build agent → personal product fleet OS

---

## Phase 0 — Discovery
**Goal:** Evaluate ideas before committing to building them.

- `hive_capture_idea` — brain dump → structured concept + interactive form UI
- `hive_evaluate_idea` — feasibility, scope, competitive check, verdict + interactive scorecard UI
- `hive_list_ideas` — kanban board of ideas with drag-to-change-status
- `hive_promote_idea` — approved idea → initialized project with confirmation card UI
- Shared UI framework: theme adaptation, reusable components, host context handling

**Every tool ships with an MCP Apps UI from day one.** Interactive, clickable, actionable — not walls of text.

**Milestone:** Every idea gets a structured evaluation with a visual scorecard you can interact with, before you write a line of code.

---

## Phase 1 — Foundation
**Goal:** Store and retrieve knowledge, with visual interfaces.

- Storage layer (read/write YAML to ~/.hive/)
- `hive_init_project`, `hive_get_architecture`, `hive_update_architecture` + architecture viewer UI
- `hive_register_pattern`, `hive_find_patterns` + pattern gallery UI
- `hive_register_dependency`, `hive_check_dependency` + API surface viewer UI

**Milestone:** You start a project and Claude has your patterns + verified deps from day one. Architecture is visual, patterns are browsable.

---

## Phase 2 — Validation
**Goal:** Catch mistakes before they happen, with visual feedback.

- `hive_validate_against_spec` — traffic light alignment view
- `hive_validate_code` — issue list with severity indicators + fix suggestions
- `hive_log_decision` — decision card UI with structured fields
- `hive_check_progress` — visual progress dashboard with component bars
- `hive_evaluate_feature` — effort/impact quadrant chart with Build/Defer/Cut/Simplify actions

**Milestone:** Claude self-corrects against your architecture instead of drifting. Scope creep gets caught with a visual bloat check before it happens.

---

## Phase 3 — Acceleration
**Goal:** Build faster by assembling from proven parts.

- `hive_scaffold_project` with stack presets
- `hive_add_feature` — drop in pre-wired patterns
- `hive_snapshot_patterns` — extract what worked back into Hive
- `hive_search_knowledge` — full-text across everything

**Milestone:** New projects are mostly assembly. First hour of setup → 5 minutes.

---

## Phase 4 — Intelligence
**Goal:** Hive starts thinking, not just storing.

- Auto-suggest patterns when starting similar projects
- Detect architecture drift (code no longer matches spec)
- Surface relevant decisions from past projects ("last time you chose X, here's why")
- Dependency staleness tracking (flag outdated cached surfaces)
- Pattern confidence scoring (used in 8 projects = high confidence)

**Milestone:** Hive proactively tells Claude what to do instead of waiting to be asked.

---

## Phase 5 — Cross-Project Intelligence
**Goal:** Knowledge compounds across your entire portfolio.

- **Pattern lineage** — track how patterns evolved across projects. "drizzle-sqlite-setup" v1 was project A, v3 (with migrations) is the current best.
- **Decision graph** — connect decisions across projects. "Every time you chose SQLite for prototypes, you migrated to Postgres at scale. Skip SQLite for projects with multi-user from the start."
- **Stack evolution** — your stacks aren't static. Track which combos worked, which caused pain, auto-update presets based on your history.
- **Anti-patterns** — register things that DIDN'T work. "Don't use library X with Y, it caused Z." Negative knowledge is as valuable as positive.
- **Project similarity scoring** — "this new idea is 80% similar to project C. Here's what you'd reuse and what's different."

Tools:
- `hive_get_insights` — "what should I know before building another agentic system?"
- `hive_compare_projects` — side-by-side arch/stack/decision comparison
- `hive_register_antipattern` — save what NOT to do
- `hive_suggest_stack` — given a description, recommend the best stack based on your history

**Milestone:** Starting project 15 feels like you've already built it. Hive knows your entire history.

---

## Phase 6 — Autonomous Build Agent
**Goal:** Go from idea → working code with minimal intervention. Introduces A2A protocol.

- **Build planner** — takes a product description, outputs a phased build plan with tasks, dependencies, and order of operations. Not just architecture — actual executable steps.
- **Task executor** — Hive orchestrates Claude Code to execute each task in sequence. You review at checkpoints, not every line.
- **Iteration loops** — after each phase, Hive runs validation (does it match spec? does the code work?) and either proceeds or flags issues.
- **Rollback awareness** — if a build step breaks something, Hive knows what changed and can revert or re-approach.
- **Session persistence** — build sessions can span multiple Claude Code sessions. Hive tracks where you left off and resumes.
- **A2A integration** — introduce Agent-to-Agent protocol for multi-agent coordination. Planning agent → coding agent → testing agent can delegate tasks to each other through A2A, while each agent uses Hive's MCP tools for context and knowledge.

Tools:
- `hive_plan_build` — "here's my idea" → phased build plan
- `hive_execute_step` — run the next step in the plan
- `hive_review_checkpoint` — visual checkpoint UI: what's built, diffs, approve/reject to continue
- `hive_resume_build` — pick up where you left off
- `hive_rollback_step` — undo last step

**Milestone:** You describe an app and walk away. Come back to a working prototype with architecture docs, decisions logged, and patterns extracted.

---

## Phase 7 — Product Lifecycle
**Goal:** Hive doesn't stop at "it works." It helps you ship, monitor, and iterate.

- **Deploy pipeline** — Hive knows how to deploy each project (Vercel, Docker, VPS, etc.) and can trigger deploys. Uses the "recipe pattern" — you configure the deploy command in YAML, Hive just runs it.
- **Health checks** — after deploy, verify the thing is actually running. Hit endpoints, check responses. Traffic-light status (green/yellow/red).
- **Error tracking integration** — pipe errors from your running products back into Hive. Pull-based: Hive runs your configured error source command on demand.
- **Usage signals** — basic analytics/logging with trend computation (up/down/flat over configurable periods).
- **Iteration backlog** — Hive maintains a typed backlog per project (bug/improvement/idea/maintenance). Fed by errors, usage, fleet scans, and manual input.
- **Kill/archive criteria** — archive projects while preserving all generated knowledge (patterns, decisions, deps stay in registry).

Tools:
- `hive_deploy` — execute configured deploy command, record result in deploy history (dry-run by default)
- `hive_check_health` — run HTTP/command health checks, return traffic-light status per check
- `hive_get_errors` — retrieve/filter recent errors by severity, date, resolution status
- `hive_get_usage` — usage stats with trend computation over configurable periods
- `hive_add_to_backlog` — log a bug, improvement, idea, or maintenance item with priority
- `hive_get_backlog` — filterable backlog query by type, priority, and status
- `hive_archive_project` — set status to archived, log decision, preserve all knowledge

Data models introduced:
- `deploy.yaml` — deploy target config + command + history per project
- `health.yaml` — health check definitions + result history per project
- `errors.yaml` — error log with severity, count, resolution tracking per project
- `usage.yaml` — usage entries with trend computation per project
- `backlog.yaml` — typed/prioritized backlog items per project

UI components:
- Deploy history timeline with status indicators
- Health check traffic-light dashboard
- Error list with severity badges and resolution tracking
- Usage trend chart with period selector
- Backlog kanban board with type/priority filters
- Archive confirmation card showing preserved knowledge

**Milestone:** You have a dashboard of all your products — what's live, what's healthy, what needs work. Every deploy is recorded, every error is tracked, every improvement is queued.

---

## Phase 8 — Fleet Management
**Goal:** Manage all your running products as a unified fleet.

- **Fleet overview** — all projects, their status, health, last deploy, last error, usage trends. Computed on-demand by scanning project directories (no separate fleet database).
- **Dependency fleet scan** — cross-reference registered dependencies with projects to find outdated or vulnerable packages fleet-wide.
- **Shared infrastructure** — topology tracking: which projects share hosts, domains, providers. Stored in `fleet/topology.yaml`.
- **Cross-project pattern propagation** — update a pattern in Hive, preview the diff across all projects that use it, then apply (dry-run by default).
- **Resource tracking** — cost registry by project, category, and provider. Tracks hosting, domains, APIs, databases — everything with a price tag.
- **Priority scoring** — weighted recommendations based on critical errors, backlog urgency, usage trends, revenue, and maintenance needs. Filterable by available time.

Tools:
- `hive_fleet_status` — scan all projects, aggregate health/errors/usage/costs into fleet overview
- `hive_fleet_scan_deps` — find outdated/vulnerable dependencies across the entire fleet
- `hive_fleet_update_pattern` — propagate a pattern change to all projects that use it (dry-run by default)
- `hive_fleet_costs` — cost breakdown grouped by project, category, or provider, with revenue comparison
- `hive_whats_next` — priority-scored recommendations for what to work on, filtered by available time

Data models introduced:
- `fleet/topology.yaml` — infrastructure topology (hosts, providers, domains, project mappings)
- `fleet/costs.yaml` — resource cost registry with per-project attribution
- `fleet/priorities.yaml` — fleet-level priority scores (computed by `hive_whats_next`)

UI components:
- Fleet dashboard with per-project health/status/cost cards
- Vulnerability table with affected projects
- Pattern diff preview across fleet
- Cost breakdown charts (by project, category, provider)
- Priority queue with action cards and effort estimates

**Milestone:** You manage 15+ live products without losing track of any of them. One command tells you what to work on next.

---

## Phase 9 — Self-Improving Hive
**Goal:** Hive learns from its own performance.

- **Build retrospectives** — after each project, analyze planning accuracy (planned vs actual components), pattern reuse rate, knowledge usage, and lessons learned. Scored 1-5 across speed, quality, and knowledge growth.
- **Tool effectiveness tracking** — which Hive tools are you actually using? Track usage in `metrics/tool-usage.yaml`. Auto-suggest improvements.
- **Pattern quality scoring** — track usage rate, modification rate after use, and staleness. Patterns that work perfectly score "high confidence." Patterns frequently modified after use score lower and get flagged for revision.
- **Effort prediction** — compare new project descriptions against past projects by similarity. Factor in pattern coverage, stack familiarity, and scope complexity. Track estimate accuracy over time.
- **Knowledge gaps** — scan all projects for repeated code/decisions that aren't captured as patterns. Find dependencies used but not registered. Identify potential anti-patterns from decision history.

Tools:
- `hive_retrospective` — analyze a completed build: planning accuracy, pattern reuse, lessons, scored 1-5
- `hive_knowledge_gaps` — find unregistered patterns, unregistered dependencies, and potential anti-patterns
- `hive_pattern_health` — score patterns by usage rate, modification rate, and staleness (fresh/aging/stale)
- `hive_estimate` — predict effort based on similar past projects, pattern coverage, and stack familiarity

Data models introduced:
- `retrospectives/{project}.yaml` — post-build analysis with scores and lessons
- `metrics/tool-usage.yaml` — which Hive tools are used and how often
- `metrics/pattern-health.yaml` — pattern quality metrics (usage, modifications, staleness)
- `metrics/estimates.yaml` — historical estimate vs actual data for accuracy tracking

UI components:
- Retrospective scorecard with radar chart (speed, quality, knowledge growth)
- Knowledge gap list with one-click "register pattern" actions
- Pattern health dashboard with confidence indicators and staleness warnings
- Estimate breakdown showing similar projects, confidence level, and contributing factors

**Milestone:** Hive is actively improving itself and telling you how to improve it further. Each build makes the next one faster.

---

## Phase 10 — Sovereign Builder OS
**Goal:** Hive is your complete operating system for building and running products.

- **Idea pipeline** — auto-score all raw ideas against current capabilities, pattern coverage, and estimated effort. Prioritize what to build next based on feasibility and impact.
- **Revenue tracking** — per-project revenue entries (subscription, one-time, usage-based). Track MRR, total customers, trends. Compare against costs for net profitability.
- **Fleet revenue dashboard** — cross-fleet P&L: total MRR vs total costs, profitable vs unprofitable projects, customer counts.
- **Automated maintenance** — define maintenance rules (security scans, staleness checks, cert expiry) as YAML recipes. Execute on demand (dry-run by default). Results feed into project backlogs.
- **Build from natural language** — "I want a CLI tool that does X" → orchestrate the full pipeline: capture idea → evaluate → promote → plan build → execute steps. This is composition of existing tools, not new capability.
- **Knowledge export** — export patterns, dependencies, decisions, stacks, and anti-patterns as a portable YAML or JSON bundle. Importable into another Hive instance.
- **Full autonomy mode** — control and monitor autonomous build sessions. View status, approve/reject pending actions, pause/resume sessions. Risk levels on pending approvals.

Tools:
- `hive_idea_pipeline` — auto-score all ideas against current capabilities and patterns, rank by build-readiness
- `hive_track_revenue` — add or query revenue data per project (MRR, customers, trends)
- `hive_fleet_revenue` — cross-fleet revenue vs cost dashboard with per-project P&L
- `hive_maintenance_run` — execute maintenance rules from schedule (dry-run by default)
- `hive_build_from_description` — natural language → orchestrated idea→evaluate→promote→plan→build pipeline
- `hive_export_knowledge` — export selected knowledge as portable YAML/JSON bundle
- `hive_autonomy_status` — view/control full-autonomy sessions (status, approve, reject, pause, resume)

Data models introduced:
- `revenue/{project}.yaml` — per-project revenue entries with model type and summary
- `maintenance/schedule.yaml` — maintenance rules with schedules and scope
- `maintenance/log.yaml` — maintenance action history and results

UI components:
- Idea pipeline board with capability scores and priority rankings
- Revenue chart per project with MRR trend
- Fleet P&L dashboard with profitable/unprofitable indicators
- Maintenance log with rule status and action history
- Build pipeline wizard showing orchestration steps and approval gates
- Knowledge export preview with category counts
- Autonomy session control panel with risk-level badges on pending approvals

**Milestone:** You are a one-person product studio running 20+ products, shipping new ones weekly, with Hive handling everything below the idea level.

---

## Timeline Reality Check

| Phase | Tools | Effort | Depends On |
|-------|-------|--------|------------|
| 0 — Discovery | 4 | 1 session | Nothing |
| 1 — Foundation | 7 | 1-2 sessions | Nothing |
| 2 — Validation | 5 | 1-2 sessions | Phase 1 |
| 3 — Acceleration | 4 | 2-3 sessions | Phase 1 |
| 4 — Intelligence | 5 | 2-3 sessions | Phase 2+3 |
| 5 — Cross-Project | 4 | 1-2 sessions | Phase 4 |
| 6 — Autonomous Agent | 5 | 3-5 sessions | Phase 4 |
| 7 — Product Lifecycle | 7 | 3-5 sessions | Phase 6 |
| 8 — Fleet Management | 5 | 2-3 sessions | Phase 7 |
| 9 — Self-Improving | 4 | 2-3 sessions | Phase 5+8 |
| 10 — Sovereign OS | 7 | 3-5 sessions | Phase 9 |
| **Total** | **57** | | |

Phases 1-4 are the foundation you build once. Phases 5-10 are the compound interest — each one makes the previous phases more powerful.

---

## The Vision

### Protocol Stack
```
Phase 0-5:  MCP (tools) + MCP Apps (interactive UI) = knowledge + visual experience
Phase 6+:   MCP + MCP Apps + A2A (agent coordination) = autonomous multi-agent builds
```

### Evolution
```
Today:     You + Claude Code + blank project = hours of setup
Phase 0:   You + Hive = interactive scorecard → "is this worth building?"
Phase 3:   You + Claude Code + Hive = minutes of assembly, visual progress tracking
Phase 6:   You + Hive = "build this" → agents coordinate → working prototype
Phase 10:  You + Hive = "I have an idea" → live, monitored product
```

Hive is the bridge between having ideas and having products.