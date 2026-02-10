# Hive — Full Roadmap

> From knowledge layer → autonomous build agent → personal product fleet OS

---

## Phase 0 — Discovery
**Goal:** Evaluate ideas before committing to building them.

- `hive_capture_idea` — brain dump → structured concept
- `hive_evaluate_idea` — feasibility, scope, competitive check, verdict
- `hive_list_ideas` — see your pipeline of ideas with status
- `hive_promote_idea` — approved idea → initialized project

**Milestone:** Every idea gets a structured evaluation before you write a line of code. No more building something for 3 hours and realizing it's not worth it.

---

## Phase 1 — Foundation
**Goal:** Store and retrieve knowledge.

- Storage layer (read/write YAML to ~/.hive/)
- `hive_init_project`, `hive_get_architecture`, `hive_update_architecture`
- `hive_register_pattern`, `hive_find_patterns`
- `hive_register_dependency`, `hive_check_dependency`

**Milestone:** You start a project and Claude has your patterns + verified deps from day one.

---

## Phase 2 — Validation
**Goal:** Catch mistakes before they happen.

- `hive_validate_against_spec` — does this code match the plan?
- `hive_validate_code` — are these imports/APIs real?
- `hive_log_decision` — record WHY, not just WHAT
- `hive_check_progress` — what's built vs what's missing?
- `hive_evaluate_feature` — is this feature real value or bloat? Checks goal alignment, effort/impact ratio, existing patterns, and what you'd cut to make room.

**Milestone:** Claude self-corrects against your architecture instead of drifting. Scope creep gets caught before it happens.

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
**Goal:** Go from idea → working code with minimal intervention.

- **Build planner** — takes a product description, outputs a phased build plan with tasks, dependencies, and order of operations. Not just architecture — actual executable steps.
- **Task executor** — Hive orchestrates Claude Code to execute each task in sequence. You review at checkpoints, not every line.
- **Iteration loops** — after each phase, Hive runs validation (does it match spec? does the code work?) and either proceeds or flags issues.
- **Rollback awareness** — if a build step breaks something, Hive knows what changed and can revert or re-approach.
- **Session persistence** — build sessions can span multiple Claude Code sessions. Hive tracks where you left off and resumes.

Tools:
- `hive_plan_build` — "here's my idea" → phased build plan
- `hive_execute_step` — run the next step in the plan
- `hive_review_checkpoint` — show what's been built, ask for approval to continue
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

## Timeline Reality Check

| Phase | Effort | Depends On |
|-------|--------|------------|
| 0 — Discovery | 1 session | Nothing |
| 1 — Foundation | 1-2 sessions | Nothing |
| 2 — Validation | 1-2 sessions | Phase 1 |
| 3 — Acceleration | 2-3 sessions | Phase 1 |
| 4 — Intelligence | 2-3 sessions | Phase 2+3 |
| 5 — Cross-Project | 1-2 sessions | Phase 4 |
| 6 — Autonomous Agent | 3-5 sessions | Phase 4 |
| 7 — Product Lifecycle | 3-5 sessions | Phase 6 |
| 8 — Fleet Management | 2-3 sessions | Phase 7 |
| 9 — Self-Improving | 2-3 sessions | Phase 5+8 |
| 10 — Sovereign OS | Ongoing | Phase 9 |

Phases 1-4 are the foundation you build once. Phases 5-10 are the compound interest — each one makes the previous phases more powerful.

---

## The Vision

```
Today:     You + Claude Code + blank project = hours of setup
Phase 0:   You + Hive = "is this worth building?" → structured verdict
Phase 3:   You + Claude Code + Hive = minutes of assembly  
Phase 6:   You + Hive = "build this" → working prototype
Phase 10:  You + Hive = "I have an idea" → live, monitored product
```

Hive is the bridge between having ideas and having products.
