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

- **Deploy pipeline** — Hive knows how to deploy each project (Vercel, Docker, VPS, etc.) and can trigger deploys.
- **Health checks** — after deploy, verify the thing is actually running. Hit endpoints, check responses.
- **Error tracking integration** — pipe errors from your running products back into Hive. "Project X is throwing 500s on /api/auth."
- **Usage signals** — basic analytics/logging so you know if anyone (including you) is using the thing.
- **Iteration backlog** — Hive maintains a list of improvements, bugs, and ideas per project. Fed by errors, usage, and your notes.
- **Kill/archive criteria** — you define when a project is dead. Hive flags projects with no usage, no commits, and suggests archiving.

Tools:
- `hive_deploy` — deploy a project to its configured target
- `hive_check_health` — is project X alive and responding?
- `hive_get_errors` — recent errors from a running project
- `hive_get_usage` — basic usage stats
- `hive_add_to_backlog` — log an improvement or bug
- `hive_get_backlog` — what needs attention?
- `hive_archive_project` — mark a project as done/dead, preserve knowledge

**Milestone:** You have a dashboard (even if it's just CLI output) of all your products — what's live, what's healthy, what needs work.

---

## Phase 8 — Fleet Management
**Goal:** Manage all your running products as a unified fleet.

- **Fleet overview** — all projects, their status, health, last deploy, last error, usage trends.
- **Dependency fleet scan** — "drizzle-orm has a security update. These 4 projects use it." One command to update all.
- **Shared infrastructure** — some projects share a VPS, a domain, a database. Hive knows the topology.
- **Cross-project migrations** — update a pattern in Hive, propagate the change to all projects that use it.
- **Resource tracking** — what are you paying for? Domains, hosting, APIs. Which projects are costing you money vs generating it?
- **Priority scoring** — based on usage, errors, revenue, and your backlog, Hive suggests which project to work on next.

Tools:
- `hive_fleet_status` — overview of all live projects
- `hive_fleet_scan_deps` — find outdated/vulnerable deps across all projects
- `hive_fleet_update_pattern` — propagate a pattern change across projects
- `hive_fleet_costs` — what you're spending and where
- `hive_whats_next` — "what should I work on today?"

**Milestone:** You manage 15+ live products without losing track of any of them.

---

## Phase 9 — Self-Improving Hive
**Goal:** Hive learns from its own performance.

- **Build retrospectives** — after each project, Hive auto-analyzes: what was fast, what was slow, where did Claude hallucinate, which patterns worked?
- **Tool effectiveness tracking** — which Hive tools are you actually using? Which are unused? Auto-suggest improvements.
- **Pattern quality scoring** — patterns that need edits after use score lower. Patterns that work perfectly score higher. Auto-promote best patterns.
- **Prediction models** — "projects like this typically take you 3 sessions to build." Get better at estimating effort.
- **Knowledge gaps** — Hive identifies what's missing. "You've built 5 auth systems but never registered the pattern. Want to snapshot it?"

Tools:
- `hive_retrospective` — analyze a completed project build
- `hive_knowledge_gaps` — what should you register that you haven't?
- `hive_pattern_health` — which patterns need updating?
- `hive_estimate` — how long will this project take based on history?

**Milestone:** Hive is actively improving itself and telling you how to improve it further.

---

## Phase 10 — Sovereign Builder OS
**Goal:** Hive is your complete operating system for building and running products.

- **Idea pipeline** — capture ideas, auto-score them against your skills/patterns/available time, prioritize.
- **Revenue tracking** — which products are making money? Which should be killed? What's your total MRR across the fleet?
- **Automated maintenance** — Hive can auto-apply security patches, dependency updates, and pattern improvements to the fleet without you touching anything.
- **Build from natural language** — "I want a CLI tool that does X" → Hive plans, builds, tests, deploys, and monitors it. You just approve checkpoints.
- **Knowledge export** — your accumulated patterns, decisions, and anti-patterns become a transferable asset. Could feed into a team's Hive instance if you ever choose to.
- **Full autonomy mode** — Hive handles the entire build-ship-monitor-iterate loop. You focus on ideas and high-level decisions.

**Milestone:** You are a one-person product studio running 20+ products, shipping new ones weekly, with Hive handling everything below the idea level.

---

## Phase 11 — Self-Replicating Hive
**Goal:** Hive improves its own code, tools, and UIs autonomously.

- Telemetry layer — every tool call logged with timing, outcome, and whether you used the result
- `hive_self_audit` — analyze tool usage, find unused/slow tools, detect repeated manual patterns, generate improvement proposals
- `hive_propose_tool` — generate specs for new or modified tools based on telemetry evidence
- `hive_evolve` — execute an approved proposal with rollback safety + dry run mode
- `hive_rollback_evolution` — revert a self-modification to previous state
- `hive_evolution_history` — timeline of all self-modifications with outcomes
- Versioned snapshots for rollback, approval checkpoint UI for all changes

**Key constraint:** Hive never modifies itself without your approval. It proposes, you review and merge — like a developer submitting PRs to its own repo.

**Milestone:** Hive submits PRs to its own repo. You review and merge. Hive at month 12 is fundamentally different from Hive at month 1.

---

## Phase 12 — Revenue Engine
**Goal:** Turn shipped products into optimized revenue streams.

- Polar.sh integration — syncs revenue data across all products via API
- `hive_revenue_dashboard` — fleet-wide MRR/ARR/churn/LTV with trends + comparison periods
- `hive_pricing_analysis` — per-product pricing recommendations based on usage patterns and plan breakdown
- `hive_growth_signals` — detect accelerating/decelerating products with signal explanations
- `hive_run_experiment` — set up A/B tests for pricing, landing pages, feature flags with statistical confidence tracking
- `hive_financial_summary` — total business P&L: revenue vs expenses, profit margin, runway, per-product profitability

**Compound effect:** Revenue data feeds back into Phase 0 (idea evaluation includes revenue potential) and Phase 8 (fleet priority scoring weighted by revenue).

**Milestone:** You know your exact MRR across 20+ products and Hive tells you where to focus for maximum revenue impact.

---

## Phase 13 — Content & Marketing Engine
**Goal:** Every product gets autonomous marketing without you writing copy.

- Code-aware marketing — Hive reads your codebase to generate accurate feature descriptions, tutorials, changelogs
- `hive_generate_launch` — full launch package: landing page, README, tweet thread, Product Hunt copy, email sequences
- `hive_generate_content` — SEO content, tutorials, docs generated from actual codebase with real code examples
- `hive_marketing_dashboard` — content performance across products with revenue attribution, content gaps, messaging insights
- `hive_draft_campaign` — multi-channel campaign from a single brief with timeline and scheduling
- `hive_auto_changelog` — changelog from git history + decision log + architecture changes
- Content performance tracking feeds back into which messaging works

**Compound effect:** Products ship with marketing built in. Phase 12 revenue grows because products actually get discovered.

**Milestone:** You ship a product and its landing page, launch copy, and first week of social content are generated before you announce it.

---

## Phase 14 — Business Operations
**Goal:** Hive handles the business side so you stay in builder mode.

- `hive_generate_invoice` — auto-generate invoices from client/project context, PDF output, Polar payment link
- `hive_financial_report` — tax-ready P&L: revenue by type/project/client, categorized expenses, quarterly tax estimates, outstanding invoices
- `hive_generate_contract` — contracts from templates (freelance, SaaS terms, privacy policy, NDA) pre-populated from business context
- `hive_compliance_scan` — check all products for compliance gaps (privacy policy, terms, cookie consent, GDPR) with auto-fix for common issues
- `hive_track_expense` — log expenses by vendor, category, and project
- `hive_client_overview` — all clients with billing status, outstanding amounts, contract expiration
- Business entity, client, invoice, expense, and contract storage all in `~/.hive/business/`

**Compound effect:** Zero admin overhead. Every hour you'd spend on business operations goes back into building.

**Milestone:** Tax season takes 30 minutes because Hive has been tracking everything all year.

---

## Phase 15 — Knowledge Marketplace
**Goal:** Monetize your compounded knowledge.

- `hive_package_pattern` — bundle verified patterns into distributable packages with sanitization (secrets stripped, code excluded by rules)
- `hive_package_stack` — bundle full stack presets as products with example project, docs, and decision rationale
- `hive_marketplace_dashboard` — sales, downloads, ratings, customer insights, suggested new packages
- `hive_export_knowledge` — selective knowledge export for clients or collaborators with format options and sanitization report
- Export rules system — minimum confidence threshold, minimum usage count, always-exclude patterns for secrets
- Two distribution models: direct sales via Polar.sh, and Hive Marketplace (shared platform, feeds into Phase 16)

**Compound effect:** Your building activity directly generates sellable assets. Every product you build creates marketplace inventory as a byproduct.

**Milestone:** Passive revenue from knowledge assets you created as a side effect of building products.

---

## Phase 16 — Network Effect (Hive Mesh)
**Goal:** Connect with other builders' Hive instances for collective intelligence.

- Federated peer-to-peer network — each Hive stays sovereign, only structural knowledge shared (never source code)
- `hive_mesh_connect` — join the mesh, manage sharing preferences, discover peers
- `hive_mesh_share` — publish anonymized patterns, anti-patterns, or benchmarks to the mesh
- `hive_mesh_insights` — get collective intelligence relevant to your stack: popular patterns, anti-patterns to watch, stack benchmarks
- `hive_mesh_delegate` — delegate tasks to specialized Hive instances via A2A protocol with budget and deadline
- `hive_mesh_reputation` — reputation scoring based on contribution quality, adoption rates, delegation success
- Privacy model: code never shared (only structure: file names, exports, interfaces), all project refs anonymized, peer identities pseudonymous

**Compound effect:** Knowledge compounds not just across YOUR projects, but across ALL Hive users' projects. Network effects make everyone's Hive smarter.

**Milestone:** Your Hive benefits from the collective intelligence of thousands of builders, while contributing your own expertise back.

---

## Beyond — The Open Frontier

Hive never stops evolving. Future capability layers emerge from what you're building and what the ecosystem enables:

- **Hardware/IoT fleet** — Hive manages physical devices, firmware updates, sensor data alongside software products.
- **Multi-modal building** — voice-first building sessions, visual architecture editing, AR workspace.
- **Sovereign AI** — Hive runs local models for sensitive operations, reducing dependence on cloud APIs.
- **Hive-to-Hive economy** — Hive instances autonomously trade knowledge, patterns, and compute with each other.

The principle stays the same: **every phase compounds on every previous phase.** Nothing is throwaway. Everything feeds forward.

---

## Timeline Reality Check

| Phase | Effort | Depends On | Compound Value |
|-------|--------|------------|----------------|
| 0 — Discovery | 1 session | Nothing | Idea quality ↑ |
| 1 — Foundation | 1-2 sessions | Nothing | Build speed ↑ |
| 2 — Validation | 1-2 sessions | Phase 1 | Hallucination ↓ |
| 3 — Acceleration | 2-3 sessions | Phase 1 | Setup time ↓↓ |
| 4 — Intelligence | 2-3 sessions | Phase 2+3 | All phases smarter |
| 5 — Cross-Project | 1-2 sessions | Phase 4 | Knowledge compounds |
| 6 — Autonomous Agent | 3-5 sessions | Phase 4 | Hands-off building |
| 7 — Product Lifecycle | 3-5 sessions | Phase 6 | Ship → monitor loop |
| 8 — Fleet Management | 2-3 sessions | Phase 7 | Scale to 20+ products |
| 9 — Self-Improving | 2-3 sessions | Phase 5+8 | Hive improves itself |
| 10 — Sovereign OS | Ongoing | Phase 9 | Full autonomy |
| 11 — Self-Replicating | 2-3 sessions | Phase 9+10 | Exponential improvement |
| 12 — Revenue Engine | 2-3 sessions | Phase 7+8 | Money optimized |
| 13 — Content/Marketing | 2-3 sessions | Phase 12 | Products get discovered |
| 14 — Business Ops | 2-3 sessions | Phase 12 | Zero admin overhead |
| 15 — Knowledge Marketplace | 3-5 sessions | Phase 5+12 | Passive revenue |
| 16 — Hive Mesh | 5+ sessions | Phase 11+15 | Network effects |

Phases 0-4 are the foundation. Phases 5-10 are the compound interest. Phases 11+ are the flywheel — each one feeds all the others.

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
Phase 13:  You + Hive = idea → product → marketing → revenue (autonomous)
Phase 16:  You + Hive Mesh = collective intelligence across a network of builders
```

Hive is the bridge between having ideas and having products.