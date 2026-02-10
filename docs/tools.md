# Hive Tool Reference

93 tools across 17 phases. Each phase builds on the previous — early phases provide the foundation, later phases add intelligence and automation.

---

## Phase 0 — Discovery

**Goal:** Evaluate ideas before committing to building them.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_capture_idea` | Capture a raw idea and structure it into an evaluable concept. Saves to `~/.hive/ideas/{slug}.yaml` | |
| `hive_evaluate_idea` | Run a structured evaluation against a captured idea to decide if it's worth building | Idea Scorecard |
| `hive_list_ideas` | List all captured ideas with their status and verdict | Idea Kanban |
| `hive_promote_idea` | Promote an evaluated idea (verdict: build) into a full project. Creates project directory with architecture, decisions, and API docs | |

---

## Phase 1 — Foundation

**Goal:** Store and retrieve knowledge with visual interfaces.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_init_project` | Initialize a new project with architecture doc, decisions log, and API registry. Optionally pre-populate from a stack preset | |
| `hive_get_architecture` | Read the current architecture doc and decisions log for a project. Call this at the start of every coding session | Architecture Viewer |
| `hive_update_architecture` | Update the architecture doc as the project evolves. Deep-merges updates into the existing doc. Optionally auto-logs a decision | |
| `hive_log_decision` | Record an architectural decision for a project | |
| `hive_register_pattern` | Save a verified code pattern to the knowledge base. Patterns are reusable across projects | |
| `hive_find_patterns` | Search for relevant patterns by query (tags or keywords) and optional stack filter | Pattern Gallery |
| `hive_register_dependency` | Cache a dependency's real API surface (exports, types, signatures, gotchas) to prevent hallucination | |
| `hive_check_dependency` | Look up a dependency's real API surface before using it. Returns exports, common patterns, and gotchas | |
| `hive_register_api` | Register an internal or external API contract for a project | |
| `hive_list_projects` | List all tracked projects with their status and stack | |
| `hive_list_patterns` | List all registered patterns with their tags | |
| `hive_list_stacks` | List all available stack presets | |

---

## Phase 2 — Validation

**Goal:** Catch mistakes before they happen.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_validate_against_spec` | Validate a proposed action or set of files against the project architecture. Use before making changes to ensure alignment | |
| `hive_validate_code` | Validate code against registered dependencies. Checks imports, signatures, and known gotchas | |
| `hive_check_progress` | Check build progress by comparing the project's architecture spec against the actual codebase on disk | Progress Dashboard |
| `hive_evaluate_feature` | Evaluate whether a proposed feature is worth building. Analyzes alignment with project goals, effort vs. impact, and returns a recommendation | Feature Evaluator |

---

## Phase 3 — Acceleration

**Goal:** Build faster by assembling from proven parts.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_scaffold_project` | Scaffold a full project from a stack preset — creates directory structure, package.json, pattern files, and a Hive project entry | Scaffold Preview |
| `hive_add_feature` | Add a feature to an existing project by matching patterns from the knowledge base. Returns file operations (create/modify) that can be applied to the project | |
| `hive_snapshot_patterns` | Extract files from a project into a reusable pattern in the knowledge base | |
| `hive_search_knowledge` | Search across all Hive knowledge — patterns, dependencies, decisions, and architectures. Returns ranked results | Search Results |

---

## Phase 4 — Intelligence

**Goal:** Hive starts thinking, not just storing.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_suggest_patterns` | Auto-suggest patterns that match a project's stack. Reads the project architecture to determine the stack, then finds patterns with overlapping stack/tags | |
| `hive_detect_drift` | Detect architecture drift by comparing the project's architecture spec against the actual codebase. Flags files that exist on disk but aren't in the spec, and spec entries missing from disk | |
| `hive_surface_decisions` | Surface relevant decisions from past projects for a given component. Useful when making a new decision — shows what was decided before and why | |
| `hive_check_staleness` | Check registered dependencies for staleness. Compares registered version against the latest published version on npm and flags outdated or old registrations | |
| `hive_score_patterns` | Score and rank all registered patterns by confidence. Patterns used across more projects rank higher. Useful for identifying your most reliable, battle-tested patterns | |

---

## Phase 5 — Cross-Project Intelligence

**Goal:** Knowledge compounds across your entire portfolio.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_pattern_lineage` | Track the version history and cross-project usage of a pattern. Shows how the pattern has evolved and which projects use it | |
| `hive_decision_graph` | Build a decision graph connecting related architectural decisions across projects. Shows patterns of choices, consensus, and conflicts for a given topic | |
| `hive_register_antipattern` | Register an anti-pattern — something you learned NOT to do. Records the context, why it's bad, and what to do instead | |
| `hive_score_similarity` | Compare a description or idea against existing projects to find similar ones. Useful for checking if something similar already exists | |
| `hive_get_insights` | Get a pre-flight briefing before building a system. Aggregates patterns, past decisions, anti-patterns, and dependency gotchas for a given type of system | |
| `hive_compare_projects` | Side-by-side comparison of two projects — stacks, components, decisions, and APIs | |
| `hive_suggest_stack` | Recommend a tech stack based on a project description and your history. Analyzes what stacks were used for similar projects and which have the most pattern support | |

---

## Phase 6 — Autonomous Build Agent

**Goal:** Go from idea to working code with minimal intervention.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_plan_build` | Take a product description and output a phased build plan with tasks, dependencies, and execution order. Requires an existing Hive project with an architecture spec | |
| `hive_execute_step` | Execute the next step in a project's build plan. Returns the task details and instructions for Claude Code to carry out | |
| `hive_review_checkpoint` | Review the current build checkpoint — shows what's been built, pending work, and file changes. Approve to continue building or reject to pause | |
| `hive_resume_build` | Resume a build that was paused or started in a previous session. Returns the current state so you can pick up where you left off | |
| `hive_rollback_step` | Undo the last completed or failed build step. Reverts created files and resets the task status to pending | |

---

## Phase 7 — Product Lifecycle

**Goal:** Ship, monitor, and iterate — not just build.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_deploy` | Deploy a project. Reads deploy.yaml for target config, supports dry-run mode | |
| `hive_check_health` | Run health checks for a project. Executes HTTP and command checks defined in health.yaml | |
| `hive_get_errors` | Get error tracking data for a project. Optionally pulls fresh errors via source_command | |
| `hive_get_usage` | Get usage data for a project. Supports period filtering and trend computation | |
| `hive_add_to_backlog` | Add an item to a project's backlog. Supports bugs, improvements, ideas, and maintenance items | |
| `hive_get_backlog` | Get a project's backlog items with optional filters | |
| `hive_archive_project` | Archive a project. Sets status to archived, logs the decision, and summarizes preserved knowledge | |

---

## Phase 8 — Fleet Management

**Goal:** Manage all running products as a unified fleet.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_fleet_status` | Get a fleet-wide status overview of all projects. Shows health, errors, usage trends, deploy status, costs, and revenue per project | |
| `hive_fleet_scan_deps` | Scan fleet dependencies for outdated packages. Cross-references registered dependencies with project architectures | |
| `hive_fleet_update_pattern` | Update a pattern across all projects that use it. Supports dry-run mode to preview changes before applying | |
| `hive_fleet_costs` | Get a fleet-wide cost breakdown with revenue comparison. Supports grouping by project, category, or provider | |
| `hive_whats_next` | Get priority-scored recommendations for what to work on next across all projects. Considers errors, backlogs, health, and usage | |

---

## Phase 9 — Self-Improving Hive

**Goal:** Hive learns from its own performance.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_retrospective` | Run a retrospective on a project build. Analyzes planning accuracy, pattern reuse, knowledge usage, and generates lessons learned with scores | |
| `hive_knowledge_gaps` | Scan all project architectures, decisions, and code patterns to find knowledge that should be registered but hasn't been | |
| `hive_pattern_health` | Analyze pattern quality metrics: usage count, modification rate, staleness, and confidence. Generates recommendations for improving the pattern library | |
| `hive_estimate` | Estimate build effort for a project based on historical data, similar projects, pattern coverage, and stack familiarity | |

---

## Phase 10 — Sovereign Builder OS

**Goal:** Your complete operating system for building and running products.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_idea_pipeline` | Score and rank all ideas by capability, pattern coverage, and estimated effort. Returns a prioritized pipeline of what to build next | |
| `hive_track_revenue` | Track revenue for a project. Use action "add" to log a revenue entry, or "query" to view revenue data | |
| `hive_fleet_revenue` | Fleet-wide P&L dashboard. Shows per-project revenue, costs, and net across all projects | |
| `hive_maintenance_run` | Run maintenance tasks from schedule.yaml. Supports dry-run mode and individual rule execution | |
| `hive_build_from_description` | End-to-end build pipeline: takes a natural language description and orchestrates idea capture, evaluation, project creation, build planning, and execution | |
| `hive_export_knowledge` | Export Hive knowledge (patterns, dependencies, decisions, stacks, anti-patterns) to a single file. Supports sanitization, recipient-aware export, and multiple formats | |
| `hive_autonomy_status` | Manage autonomous build sessions. View status, approve/reject pending actions, pause or resume sessions | |

---

## Phase 11 — Self-Replicating Hive

**Goal:** Hive improves its own code, tools, and UIs autonomously.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_self_audit` | Audit Hive tool usage from telemetry. Identifies unused tools, slow tools, error patterns, repeated manual patterns, and generates improvement proposals. Returns a health score (0-100) | |
| `hive_propose_tool` | Propose a new tool, refactor, removal, schema change, or UI change for Hive. Generates a structured proposal with evidence from telemetry analysis | |
| `hive_evolve` | Apply a pending or approved proposal to evolve Hive. Creates a rollback snapshot, applies changes, logs the evolution. Supports dry-run mode | |
| `hive_rollback_evolution` | Rollback a self-modification by restoring files from the version snapshot. Updates the evolution log outcome to "rolled_back" | |
| `hive_evolution_history` | View the history of Hive self-modifications. Shows evolution entries with type, status, files changed, and outcomes | |

---

## Phase 12 — Revenue Engine

**Goal:** Turn shipped products into optimized revenue streams.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_revenue_dashboard` | Revenue dashboard across all products. Shows MRR, ARR, churn, LTV, per-product breakdown, growth signals, and period comparisons | |
| `hive_pricing_analysis` | Analyze pricing for a project. Shows current pricing tiers, ARPU, price sensitivity signals, and generates pricing recommendations | |
| `hive_growth_signals` | Detect growth signals across all products. Classifies products as accelerating, decelerating, or stable with actionable recommendations | |
| `hive_run_experiment` | Create and track an A/B experiment for a project. Supports pricing, landing page, and feature flag experiments | |
| `hive_financial_summary` | Full financial summary across all projects. Shows revenue breakdown, expenses breakdown, profit, margin, runway, and per-product profitability | |

---

## Phase 13 — Content & Marketing Engine

**Goal:** Every product gets autonomous marketing without you writing copy.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_generate_launch` | Generate launch assets for a project. Creates landing page, README, tweets, Product Hunt listing, email sequences, and changelog from project architecture | |
| `hive_generate_content` | Generate content for a project. Supports blog posts, tutorials, documentation, comparisons, and case studies | |
| `hive_marketing_dashboard` | View marketing analytics dashboard. Shows content performance, gaps, and messaging insights | |
| `hive_draft_campaign` | Draft a multi-channel marketing campaign with timeline and content pieces | |
| `hive_auto_changelog` | Auto-generate a changelog from git history, decision log, and architecture changes | |

---

## Phase 14 — Business Operations

**Goal:** Hive handles the business side so you stay in builder mode.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_generate_invoice` | Generate an invoice for a client. Auto-fills from client profile and billing terms. Supports line items or auto-generation from project deliverables | |
| `hive_financial_report` | Generate a financial report with revenue breakdown, expenses breakdown, profit, tax estimates, and outstanding invoices | |
| `hive_generate_contract` | Generate a contract from templates. Auto-fills variables from business entity, client profile, and project context | |
| `hive_compliance_scan` | Scan projects for compliance issues: missing privacy policy, outdated terms, no cookie consent, missing GDPR controls, accessibility gaps | |
| `hive_track_expense` | Track a business expense. Categorized by vendor and type, optionally linked to a project | |
| `hive_client_overview` | Get an overview of all clients with billing status, active projects, outstanding invoices, and contract status | |

---

## Phase 15 — Knowledge Marketplace

**Goal:** Monetize your compounded knowledge.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_package_pattern` | Package one or more patterns from the knowledge base into a distributable marketplace package. Sanitizes secrets and generates a public preview | |
| `hive_package_stack` | Package a stack preset (with its patterns) into a distributable marketplace package. Includes setup guide and architecture overview | |
| `hive_marketplace_dashboard` | View marketplace analytics: package downloads, revenue, ratings, and customer insights | |

---

## Phase 16 — Hive Mesh

**Goal:** Connect with other builders for collective intelligence.

| Tool | Description | UI View |
|------|-------------|---------|
| `hive_mesh_connect` | Connect to the Hive Mesh peer-to-peer knowledge network. Join, update profile, check status, or disconnect | |
| `hive_mesh_share` | Share knowledge to the Hive Mesh network. Shares pattern structure, anti-patterns, or stack benchmarks with anonymization. Source code is never shared | |
| `hive_mesh_insights` | Get insights from the Hive Mesh network. Returns relevant patterns, anti-patterns, and stack benchmarks filtered by your project context | |
| `hive_mesh_delegate` | Delegate a task to a mesh peer via A2A protocol. Searches for peers with matching specialties and reputation | |
| `hive_mesh_reputation` | View reputation profile for yourself or a mesh peer. Shows reputation score, rank, contributions, and history | |
