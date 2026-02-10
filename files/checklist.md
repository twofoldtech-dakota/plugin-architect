# Hive — Implementation Checklist

## Project Setup

- [x] Initialize Node.js/TypeScript project (`package.json`, `tsconfig.json`)
- [x] Install core dependencies: `@modelcontextprotocol/sdk`, `yaml`
- [x] Install MCP Apps dependencies: `@modelcontextprotocol/ext-apps`
- [x] Install UI tooling: `vite`, `vite-plugin-singlefile`, `preact` (or vanilla)
- [x] Set up project structure:
  ```
  src/
    server/
      index.ts            # MCP server entry
      tools/              # Tool handlers
      storage/            # YAML read/write layer
    ui/
      shared/             # Theme, reusable components
      views/              # Per-tool UI mini-apps
    build/
      bundle.ts           # Vite config for single-HTML bundles
  ```
- [x] Create MCP server entry point (`src/server/index.ts`) with `@modelcontextprotocol/sdk`
- [x] Build script to compile TypeScript + bundle UI views into single HTML files
- [x] Verify server starts and registers with an MCP client (e.g., Claude Code)

## Storage Layer

- [x] Implement `~/.hive/` directory initialization (create dirs on first run)
  - `config.yaml`, `ideas/`, `projects/`, `knowledge/patterns/`, `knowledge/dependencies/`, `knowledge/stacks/`, `templates/`
  - `fleet/`, `retrospectives/`, `metrics/`, `revenue/`, `maintenance/`
  - `meta/`, `integrations/`, `marketing/`, `business/`, `marketplace/`, `mesh/`
- [x] YAML read helper — read and parse a `.yaml` file, return typed object
- [x] YAML write helper — serialize object and write to `.yaml` file
- [x] Slugify utility — convert names to URL-safe slugs for file names
- [x] Auto-create parent directories when writing new files

## Shared UI Framework

- [x] `src/ui/shared/styles.css` — shared theme that adapts to host context (dark/light mode via `ui/initialize`)
- [x] `src/ui/shared/components.ts` — reusable UI primitives (cards, buttons, forms, tags, status badges)
- [x] Vite config (`src/build/bundle.ts`) to bundle each view directory into a standalone single HTML file
- [x] Host context adapter — receive `structuredContent` from tool results, call back via `tools/call`

---

## Phase 0 — Discovery

### `hive_capture_idea`
- [x] Tool handler: accept `description`, optional `problem`, `audience`
- [x] Generate slug from description
- [x] Structure into idea schema: `name`, `slug`, `problem`, `audience`, `proposed_solution`, `assumptions[]`, `open_questions[]`, `status: "raw"`
- [x] Write to `~/.hive/ideas/{slug}.yaml`
- [x] Return structured content (the saved idea)
- [x] UI: structured form with description, problem, audience fields + submit button

### `hive_evaluate_idea`
- [x] Tool handler: accept `idea` (slug)
- [x] Read idea from `~/.hive/ideas/{slug}.yaml`
- [x] Generate evaluation structure:
  - `feasibility`: score (1-5), `has_patterns`, `known_stack`, `estimated_sessions`, `unknowns[]`
  - `competitive`: `exists_already`, `differentiator`, `references[]`
  - `scope`: `mvp_definition`, `mvp_components[]`, `deferred[]`, `full_vision`
  - `verdict`: "build" | "park" | "kill" | "needs_more_thinking"
  - `reasoning`
- [x] Merge evaluation into the idea YAML, update status to "evaluated"
- [x] Return structured evaluation
- [x] UI: interactive scorecard with visual indicators, verdict buttons (Build / Park / Kill), MVP scope editor

### `hive_list_ideas`
- [x] Tool handler: accept optional `status` filter
- [x] Read all YAML files from `~/.hive/ideas/`
- [x] Return summary list (name, slug, status, verdict if evaluated)
- [x] UI: kanban board with columns for raw/evaluated/approved/parked/rejected, click to expand, drag to change status

### `hive_promote_idea`
- [x] Tool handler: accept `idea` (slug)
- [x] Read idea, verify it has been evaluated and verdict is "build"
- [x] Call `hive_init_project` logic with idea's MVP scope
- [x] Update idea status to "approved"
- [x] Return confirmation with project details
- [x] UI: confirmation card showing MVP scope, stack recommendation, "Create Project" button

---

## Phase 1 — Foundation

### `hive_init_project`
- [x] Tool handler: accept `name`, `description`, optional `stack` (preset slug)
- [x] Create `~/.hive/projects/{name}/` directory
- [x] Create `architecture.yaml` with initial structure (project, description, created, updated, status, stack, components, data_flows, file_structure)
- [x] Create empty `decisions.yaml` (`decisions: []`)
- [x] Create empty `apis.yaml` (`apis: []`)
- [x] If stack preset provided, read from `~/.hive/knowledge/stacks/{stack}.yaml` and pre-populate architecture
- [x] Return full architecture doc

### `hive_get_architecture`
- [x] Tool handler: accept `project` (slug)
- [x] Read `~/.hive/projects/{project}/architecture.yaml`
- [x] Read `~/.hive/projects/{project}/decisions.yaml`
- [x] Return combined architecture + decisions
- [x] UI: visual component diagram with data flows, clickable components showing details/files/dependencies

### `hive_update_architecture`
- [x] Tool handler: accept `project`, `updates` (partial object), optional `reason`
- [x] Read current architecture, deep-merge updates
- [x] Update `updated` timestamp
- [x] If `reason` provided, auto-log a decision via `hive_log_decision` logic
- [x] Write updated architecture
- [x] Return updated doc

### `hive_register_pattern`
- [x] Tool handler: accept `name`, `description`, `tags[]`, `files[]` (path + content), optional `notes`
- [x] Generate slug from name
- [x] Write pattern to `~/.hive/knowledge/patterns/{slug}.yaml` with: name, description, tags, stack, verified: true, created date, used_in: [], files, notes
- [x] Update `~/.hive/knowledge/patterns/index.yaml` — add entry with slug + tags
- [x] Return confirmation
- [x] UI: code preview with syntax highlighting, tag editor, save confirmation

### `hive_find_patterns`
- [x] Tool handler: accept `query` (natural language or tags), optional `stack[]` filter
- [x] Read `~/.hive/knowledge/patterns/index.yaml`
- [x] Match by tags and keyword search against names/descriptions
- [x] If `stack` filter provided, filter by stack field
- [x] Read and return full content of matching patterns
- [x] UI: pattern gallery with cards (name, tags, usage count), click to expand, "Apply to project" button

### `hive_register_dependency`
- [x] Tool handler: accept `name`, `version`, `surface` (exports, types, signatures, gotchas), optional `source` (docs URL)
- [x] Create `~/.hive/knowledge/dependencies/{name}/` directory
- [x] Write `meta.yaml` with name, version, fetched date, source
- [x] Write `surface.yaml` with exports, column_types, common_patterns, gotchas
- [x] Return confirmation
- [x] UI: API surface viewer with collapsible exports, signatures, highlighted gotchas

### `hive_check_dependency`
- [x] Tool handler: accept `name`
- [x] Check if `~/.hive/knowledge/dependencies/{name}/` exists
- [x] If exists: read and return `surface.yaml` + `meta.yaml`
- [x] If not: return "not registered — consider registering"
- [x] UI: quick reference card with key exports, common patterns, gotchas; "Not registered" state with one-click register button

### `hive_register_api`
- [x] Tool handler: accept `project`, `name`, `type` (internal/external), `base`, `endpoints[]`
- [x] Read `~/.hive/projects/{project}/apis.yaml`
- [x] Append or update API entry
- [x] Write back to `apis.yaml`
- [x] Return confirmation

---

## Phase 2 — Validation

### `hive_validate_against_spec`
- [x] Tool handler: accept `project`, `action` (what Claude is about to do), optional `files[]`
- [x] Read project architecture
- [x] Compare proposed action/files against architecture components, file_structure, and dependencies
- [x] Return `{ aligned: boolean, concerns: string[], suggestions: string[] }`
- [x] UI: traffic light view — green (aligned), yellow (concerns), red (conflicts) with expandable details

### `hive_validate_code`
- [x] Tool handler: accept `code`, `file_path`, `project`
- [x] Parse imports from code
- [x] Check imports against registered dependencies — flag unknown imports
- [x] Check function signatures against registered dependency surfaces — flag wrong signatures
- [x] Check against known gotchas from dependency surfaces
- [x] Return `{ issues: Issue[], verified: boolean }`
- [x] UI: issue list with severity indicators, expandable items with fix suggestions

### `hive_log_decision`
- [x] Tool handler: accept `project`, `component`, `decision`, `reasoning`, optional `alternatives[]`, `revisit_when`
- [x] Read `~/.hive/projects/{project}/decisions.yaml`
- [x] Auto-increment ID (format "001", "002", etc.)
- [x] Append decision entry with date
- [x] Write back
- [x] Return confirmation with decision ID
- [x] UI: decision card with structured fields, auto-linked to component

### `hive_check_progress`
- [x] Tool handler: accept `project`, `project_path` (path to actual codebase)
- [x] Read project architecture (components with file globs)
- [x] Scan `project_path` filesystem to check which files/directories exist
- [x] Classify each component as built, in_progress, or missing
- [x] Calculate coverage percentage
- [x] Return `{ built[], in_progress[], missing[], coverage_pct }`
- [x] UI: progress dashboard with component bars (built/in-progress/missing), overall coverage percentage

### `hive_evaluate_feature`
- [x] Tool handler: accept `project`, `feature`, optional `reasoning`
- [x] Read project architecture (goals, components, scope)
- [x] Generate alignment analysis: score (1-5), supports_goals, irrelevant_to_goals, verdict (core/nice-to-have/bloat/distraction)
- [x] Generate effort vs impact analysis: estimated_effort, estimated_impact, ratio
- [x] Check for existing patterns that could accelerate the feature
- [x] Generate tradeoffs: what_to_cut, complexity_added, maintenance_burden
- [x] Return recommendation: "build it" | "defer it" | "cut it" | "simplify it" (with simplified_alternative if applicable)
- [x] UI: effort/impact quadrant chart, feature plotted on grid, recommendation card with Build/Defer/Cut/Simplify actions

---

## Phase 3 — Acceleration

### `hive_scaffold_project`
- [x] Tool handler: accept `name`, `stack` (preset slug), `output_path`
- [x] Read stack preset from `~/.hive/knowledge/stacks/{stack}.yaml`
- [x] Read all patterns referenced by the preset
- [x] Generate `package.json` with production + dev dependencies from preset
- [x] Create file structure from preset's `file_structure`
- [x] Write pattern files into the project
- [x] Call `hive_init_project` logic to create the Hive project entry
- [x] Return list of created files
- [x] UI: stack preview showing file tree, dependencies, patterns + "Scaffold" button

### `hive_add_feature`
- [x] Tool handler: accept `project`, `feature` (natural language or pattern name), `project_path`
- [x] Read project architecture
- [x] Search patterns matching the feature
- [x] Determine which files to create/modify based on matching patterns + architecture
- [x] Return file operations (create/modify with content)

### `hive_snapshot_patterns`
- [x] Tool handler: accept `project`, `project_path`, `files[]`, `name`, `tags[]`
- [x] Read specified files from `project_path`
- [x] Create pattern YAML with file contents
- [x] Write to `~/.hive/knowledge/patterns/{slug}.yaml`
- [x] Update pattern index
- [x] Add project to pattern's `used_in` list
- [x] Return confirmation

### `hive_search_knowledge`
- [x] Tool handler: accept `query`
- [x] Search across all knowledge types: patterns (index + content), dependencies (meta + surface), decisions (all projects), architectures (all projects)
- [x] Rank results by relevance (tag match, keyword match in names/descriptions)
- [x] Return ranked results with type labels
- [x] UI: tabbed search results — Patterns / Dependencies / Decisions / Architectures, click to drill in

### Meta Tools
- [x] `hive_list_projects` — read all dirs in `~/.hive/projects/`, return name + status + stack for each
- [x] `hive_list_patterns` — read `~/.hive/knowledge/patterns/index.yaml`, return all with tags
- [x] `hive_list_stacks` — read all files in `~/.hive/knowledge/stacks/`, return name + description + tags for each

---

## Phase 4 — Intelligence

- [x] Auto-suggest patterns when starting a project with a similar stack to existing patterns
- [x] Detect architecture drift — compare codebase files against architecture spec, flag divergence
- [x] Surface relevant decisions from past projects when logging a new decision on a similar component
- [x] Dependency staleness tracking — compare registered version against latest published version, flag outdated
- [x] Pattern confidence scoring — track usage count across projects, surface high-confidence patterns first

---

## Phase 5 — Cross-Project Intelligence

- [x] Pattern lineage — track version history of patterns as they evolve across projects
- [x] Decision graph — connect related decisions across projects, surface "last time you chose X, here's why"
- [x] Anti-pattern registry (`hive_register_antipattern`) — save what NOT to do with context
- [x] Project similarity scoring — compare new idea against existing project architectures/stacks
- [x] `hive_get_insights` — "what should I know before building another [type] system?"
- [x] `hive_compare_projects` — side-by-side arch/stack/decision comparison
- [x] `hive_suggest_stack` — recommend best stack based on project description + history

---

## Phase 6 — Autonomous Build Agent + A2A Protocol

- [x] `hive_plan_build` — take product description, output phased build plan with tasks, dependencies, order
- [x] `hive_execute_step` — orchestrate Claude Code to execute next step in the plan
- [x] `hive_review_checkpoint` — show what's been built, ask for approval to continue
- [x] `hive_resume_build` — session persistence across Claude Code sessions, track where left off
- [x] `hive_rollback_step` — undo last build step (revert file changes)
- [x] A2A integration — multi-agent coordination (planning agent → coding agent → testing agent)
- [x] Visual checkpoint UI for build reviews

---

## Phase 7 — Product Lifecycle

### Storage: Per-Project Additions
- [x] `deploy.yaml` schema — deploy target, command, directory, environment_vars, pre_deploy, history
- [x] `health.yaml` schema — health check definitions (HTTP/command), result history
- [x] `errors.yaml` schema — error entries with severity, count, resolution tracking, source_command
- [x] `usage.yaml` schema — usage entries with trends, source_command
- [x] `backlog.yaml` schema — typed/prioritized backlog items (bug/improvement/idea/maintenance)

### `hive_deploy`
- [x] Tool handler: accept `project`, optional `dry_run` (default: true), optional `notes`
- [x] Read `deploy.yaml` from project directory
- [x] If dry_run: return the commands that would execute without running them
- [x] If not dry_run: run pre_deploy commands, then deploy command in configured directory
- [x] Record deploy result (id, date, status, duration, version, commit, url/error) to history
- [x] Return deploy record with status
- [x] UI: deploy history timeline with status indicators + dry-run preview

### `hive_check_health`
- [x] Tool handler: accept `project`
- [x] Read `health.yaml` from project directory
- [x] If no health.yaml: return "not configured" with setup instructions
- [x] Execute each check (HTTP request or shell command) with timeout
- [x] Determine per-check status: green (ok), yellow (slow/degraded), red (failed)
- [x] Compute overall status (worst individual status)
- [x] Append result to health.yaml results
- [x] Return traffic-light status per check + overall
- [x] UI: traffic-light health dashboard with response times and error details

### `hive_get_errors`
- [x] Tool handler: accept `project`, optional `severity`, `since`, `resolved` filters
- [x] If source_command configured: run it to pull fresh errors, parse output, append new entries
- [x] Read `errors.yaml` from project directory
- [x] Apply filters (severity, date range, resolution status)
- [x] Compute summary: total, by_severity breakdown, unresolved count
- [x] Return filtered entries + summary
- [x] UI: error list with severity badges, resolution tracking, source command status

### `hive_get_usage`
- [x] Tool handler: accept `project`, optional `period` ("7d" | "30d" | "90d", default: "7d")
- [x] If source_command configured: run it to pull fresh usage data
- [x] Read `usage.yaml` from project directory
- [x] Filter entries by period
- [x] Compute trend: direction (up/down/flat), change_pct over period
- [x] Compute summary: avg daily requests, avg daily visitors, avg error rate
- [x] Update trend in usage.yaml
- [x] Return entries + trend + summary
- [x] UI: usage trend chart with period selector and summary stats

### `hive_add_to_backlog`
- [x] Tool handler: accept `project`, `type` (bug/improvement/idea/maintenance), `title`, optional `description`, `priority` (default: "medium"), `source`
- [x] Read or create `backlog.yaml` for project
- [x] Auto-increment backlog item ID (format "bl-001")
- [x] Set status to "open", created date to now
- [x] Append item to backlog
- [x] Write back
- [x] Return created item with ID
- [x] UI: backlog form with type/priority selectors + submit

### `hive_get_backlog`
- [x] Tool handler: accept `project`, optional `type`, `priority`, `status` (default: "open") filters
- [x] Read `backlog.yaml` from project directory
- [x] Apply filters
- [x] Compute summary: total, by_type breakdown, by_priority breakdown
- [x] Return filtered items + summary
- [x] UI: kanban backlog board with type/priority filters

### `hive_archive_project`
- [x] Tool handler: accept `project`, optional `reason`
- [x] Set project status to "archived" in architecture.yaml
- [x] Log archival decision in decisions.yaml with reason
- [x] Count preserved knowledge (patterns extracted, decisions logged, deps registered)
- [x] Return confirmation with knowledge preservation summary
- [x] UI: archive confirmation card showing preserved knowledge counts

---

## Phase 8 — Fleet Management

### Storage: Fleet Directory
- [x] `fleet/topology.yaml` schema — hosts (provider, type, projects, specs), domains (registrar, DNS, expiry)
- [x] `fleet/costs.yaml` schema — cost entries (name, category, provider, amount, period, projects), totals
- [x] `fleet/priorities.yaml` schema — computed priority scores per project

### `hive_fleet_status`
- [x] Tool handler: accept optional `include_archived` (default: false)
- [x] Scan all project directories under `~/.hive/projects/`
- [x] For each project: read architecture (status), health.yaml (overall), errors.yaml (recent count), usage.yaml (trend), deploy.yaml (last deploy)
- [x] Read `fleet/costs.yaml` for per-project costs
- [x] Read `revenue/` files for per-project revenue
- [x] Aggregate into fleet summary: total projects, healthy/unhealthy count, total cost, total revenue
- [x] Return per-project status cards + fleet summary
- [x] UI: fleet dashboard with per-project health/status/cost cards

### `hive_fleet_scan_deps`
- [x] Tool handler: accept optional `package` (specific package name), `severity` (minimum vulnerability severity)
- [x] Read registered dependencies from `knowledge/dependencies/`
- [x] Cross-reference with all project architecture files to find which projects use which deps
- [x] Identify outdated packages (registered version vs known latest)
- [x] Return outdated list (package, current version, latest, affected projects) + vulnerabilities if any
- [x] UI: vulnerability/outdated table with affected project badges

### `hive_fleet_update_pattern`
- [x] Tool handler: accept `pattern` (slug), optional `dry_run` (default: true)
- [x] Read pattern from `knowledge/patterns/{slug}.yaml`
- [x] Find all projects in pattern's `used_in` list
- [x] For each project: determine files that would change, generate diff preview
- [x] If dry_run: return affected projects + diff previews without modifying
- [x] If not dry_run: apply changes, log update decision in each project's decisions.yaml
- [x] Return affected projects list with applied status
- [x] UI: diff preview per project with apply/skip controls

### `hive_fleet_costs`
- [x] Tool handler: accept optional `group_by` ("project" | "category" | "provider", default: "project")
- [x] Read `fleet/costs.yaml`
- [x] Read all `revenue/` files
- [x] Group costs by requested dimension
- [x] Compute totals (monthly, yearly) and cost vs revenue comparison
- [x] Return grouped breakdown + totals + net revenue
- [x] UI: cost breakdown charts (bar/pie) with revenue comparison

### `hive_whats_next`
- [x] Tool handler: accept optional `available_time` ("quick" | "session" | "deep", default: "session"), `focus` (area filter)
- [x] Scan all projects: backlogs, errors, health, usage
- [x] Score each potential action: critical errors (highest weight) > high backlog items > usage drops > maintenance > improvements
- [x] Filter by available_time (quick = trivial/small tasks only, session = medium, deep = any)
- [x] Filter by focus area if provided
- [x] Return priority-scored recommendations with project, action, reason, score, effort, source
- [x] UI: priority queue with action cards, effort estimates, source signals

---

## Phase 9 — Self-Improving Hive

### Storage: Retrospectives + Metrics
- [x] `retrospectives/{project}.yaml` schema — build analysis with planning accuracy, pattern reuse, knowledge usage, lessons, scores
- [x] `metrics/tool-usage.yaml` schema — Hive tool usage tracking
- [x] `metrics/pattern-health.yaml` schema — pattern quality metrics (uses, modifications, staleness, confidence)
- [x] `metrics/estimates.yaml` schema — historical estimate vs actual data

### `hive_retrospective`
- [x] Tool handler: accept `project`
- [x] Read project architecture (initial plan vs current state)
- [x] Count planned vs actual components, compute scope change
- [x] Read patterns used (from architecture + decisions), compute reuse rate
- [x] Count pre-registered deps used, new deps added, decisions informed by history, hallucinations caught
- [x] Generate lessons learned from decisions and scope changes
- [x] Score 1-5: speed, quality, knowledge growth, compute overall
- [x] Save to `~/.hive/retrospectives/{project}.yaml`
- [x] Return full retrospective
- [x] UI: retrospective scorecard with radar chart (speed/quality/knowledge growth) and lessons list

### `hive_knowledge_gaps`
- [x] Tool handler: accept optional `scope` ("all" or project slug, default: "all")
- [x] Scan all project architectures, decisions, and code patterns
- [x] Cross-reference with registered patterns — find repeated code not captured as patterns
- [x] Cross-reference with registered dependencies — find used but unregistered deps
- [x] Identify potential anti-patterns from decision history (repeated "revisit_when" triggers, reverted decisions)
- [x] Return unregistered patterns (with evidence + suggested name), unregistered deps, potential anti-patterns
- [x] UI: gap list with one-click "register pattern" / "register dependency" actions

### `hive_pattern_health`
- [x] Tool handler: accept optional `pattern` (specific slug, or all)
- [x] Read all pattern files and their `used_in` lists
- [x] For each pattern: count total uses, recent uses (30d), modifications after use
- [x] Compute modification rate, staleness (fresh/aging/stale based on last use), confidence (high/medium/low)
- [x] Generate recommendations (e.g., "consider splitting into variants" for high modification rate)
- [x] Update `metrics/pattern-health.yaml`
- [x] Return per-pattern health + summary (total, fresh/aging/stale counts, avg confidence)
- [x] UI: pattern health dashboard with confidence indicators and staleness warnings

### `hive_estimate`
- [x] Tool handler: accept `description`, optional `components` (count), `stack` (preset slug)
- [x] Read `metrics/estimates.yaml` for historical data
- [x] Compare description against all past project architectures for similarity scoring
- [x] Factor in: pattern coverage (% of likely needs covered), stack familiarity (past use of this stack), scope complexity
- [x] Compute estimated sessions based on similar projects' actual sessions, weighted by similarity
- [x] Compute confidence level based on number of similar projects and historical accuracy
- [x] Return estimate with similar projects, contributing factors, historical accuracy
- [x] UI: estimate breakdown showing similar projects, confidence level, contributing factors

---

## Phase 10 — Sovereign Builder OS

### Storage: Revenue + Maintenance
- [x] `revenue/{project}.yaml` schema — revenue model, entries (date, amount, customers, source), summary (MRR, total, trend)
- [x] `maintenance/schedule.yaml` schema — maintenance rules (command/hive_tool, schedule, applies_to, auto_apply)
- [x] `maintenance/log.yaml` schema — maintenance action history (date, rule, result, action_taken)

### `hive_idea_pipeline`
- [x] Tool handler: accept optional `filter` ("raw" | "evaluated" | "all", default: "raw")
- [x] Read all ideas from `~/.hive/ideas/`
- [x] For each idea: score capability (how much can be built with existing patterns/knowledge)
- [x] Score pattern coverage (% of likely needs covered by existing patterns)
- [x] Estimate sessions based on similar past projects
- [x] Compute priority score (weighted by feasibility + impact + effort)
- [x] Return ranked ideas with scores and recommendations (build next / build soon / park / needs evaluation)
- [x] UI: pipeline board with capability scores and priority rankings

### `hive_track_revenue`
- [x] Tool handler: accept `project`, `action` ("add" | "query"), optional `entry` (for add), `period` (for query)
- [x] If action is "add": read or create `revenue/{project}.yaml`, append entry, update summary (MRR, total, customers, trend)
- [x] If action is "query": read revenue file, filter by period, return entries + summary
- [x] Return entries + summary with MRR, total revenue, total customers, trend
- [x] UI: revenue chart per project with MRR trend line

### `hive_fleet_revenue`
- [x] Tool handler: accept optional `period` ("3m" | "6m" | "12m" | "all", default: "all")
- [x] Read all `revenue/` files
- [x] Read `fleet/costs.yaml`
- [x] Compute per-project: MRR, monthly cost, net, customers, trend
- [x] Compute fleet totals: total MRR, total cost, total net, total customers, profitable vs unprofitable count
- [x] Return per-project P&L + fleet totals
- [x] UI: fleet P&L dashboard with profitable/unprofitable indicators

### `hive_maintenance_run`
- [x] Tool handler: accept optional `rule` (specific rule ID, or all), `dry_run` (default: true)
- [x] Read `maintenance/schedule.yaml`
- [x] If specific rule: filter to that rule; otherwise run all
- [x] If dry_run: show what each rule would execute without running
- [x] If not dry_run: execute each rule's command/tool, capture output
- [x] Determine result status: ok / action_needed / failed
- [x] If action_needed: optionally add items to relevant project backlogs
- [x] Append results to `maintenance/log.yaml`
- [x] Return per-rule results with status and actions taken
- [x] UI: maintenance log with rule status, output, and action history

### `hive_build_from_description`
- [x] Tool handler: accept `description` (natural language), optional `auto_approve` (default: false)
- [x] Orchestrate existing tools in sequence:
  1. `hive_capture_idea` — structure the description into an idea
  2. `hive_evaluate_idea` — run feasibility check
  3. `hive_promote_idea` — create project if evaluation passes
  4. `hive_plan_build` — generate phased build plan
  5. `hive_execute_step` — begin building (if auto_approve)
- [x] At each step: pause for approval if `auto_approve` is false
- [x] Return pipeline status with current step + next action
- [x] UI: pipeline wizard showing orchestration steps with approval gates

### `hive_export_knowledge`
- [x] Tool handler: accept optional `scope` ("all" or categories array), `format` ("yaml" | "json", default: "yaml"), `output_path`
- [x] Collect selected knowledge: patterns, dependencies, decisions, stacks, anti-patterns
- [x] Bundle into a single file with metadata (export date, source Hive version, counts)
- [x] Write to output_path (default: `~/.hive/exports/`)
- [x] Return export summary (counts per category, file path, size)
- [x] UI: export preview with category counts and format selector
- [x] **Note:** Superseded by the enhanced Phase 15 version (adds sanitization, structured scope, zip/markdown formats, recipient-aware export)

### `hive_autonomy_status`
- [x] Tool handler: accept `action` ("status" | "approve" | "reject" | "pause" | "resume"), optional `session_id`
- [x] If "status": list all active/paused/awaiting build sessions with progress
- [x] If "approve": resume paused session, execute pending action
- [x] If "reject": roll back pending action, keep session paused
- [x] If "pause": pause running session at next safe checkpoint
- [x] If "resume": continue a paused session from where it left off
- [x] Show risk level (low/medium/high) on pending approvals
- [x] Return session list with status, progress, and pending approvals
- [x] UI: session control panel with risk-level badges and approve/reject/pause/resume controls

---

## Phase 11 — Self-Replicating Hive

### Storage: Meta Directory
- [x] `meta/telemetry.yaml` schema — tool call log: tool, args, duration, outcome, user_action, session
- [x] `meta/evolution_log.yaml` schema — history of self-modifications (id, date, type, proposal_id, description, files_changed, rollback_version, outcome)
- [x] `meta/proposals/{id}.yaml` schema — improvement proposals with type, status, target, proposal details, evidence
- [x] `meta/versions/{timestamp}/` — rollback snapshots

### `hive_self_audit`
- [x] Tool handler: accept optional `period` ("last_week" | "last_month" | "all_time", default: "last_month"), `focus` ("unused_tools" | "slow_tools" | "error_patterns" | "gaps" | "all")
- [x] Read `meta/telemetry.yaml` and filter by period
- [x] Compute per-tool usage stats: calls, avg_duration_ms, used_pct, ignored_pct, error_pct
- [x] Identify unused tools, slow tools (with p95), repeated manual patterns with suggested tool names
- [x] Compute overall health score (0-100)
- [x] Generate improvement proposals and save to `meta/proposals/`
- [x] Return tool usage breakdown, unused/slow lists, repeated patterns, proposals generated count, health score
- [x] UI: dashboard with tool usage heatmap, unused tools highlighted, slow tools with flame icon, "Create Tool" buttons for repeated patterns, health score gauge

### `hive_propose_tool`
- [x] Tool handler: accept `type` ("new_tool" | "refactor_tool" | "remove_tool" | "schema_change" | "ui_change"), optional `target` (existing tool name), optional `description`
- [x] If no description provided, auto-generate from telemetry analysis
- [x] Generate proposal: name, description, reasoning, input_schema, output, implementation_plan, estimated_effort, affected_tools, affected_ui
- [x] Gather evidence from telemetry (tool_calls_analyzed, pattern_detected, time_saved_per_call)
- [x] Write to `meta/proposals/{id}.yaml` with status "pending"
- [x] Return proposal_id, type, full proposal object, evidence
- [x] UI: proposal card with spec preview, before/after for refactors, evidence with telemetry charts, Approve/Reject/Modify buttons

### `hive_evolve`
- [x] Tool handler: accept `proposal_id`, optional `dry_run` (default: false)
- [x] Read proposal from `meta/proposals/{proposal_id}.yaml`, verify status is "pending" or "approved"
- [x] Create rollback snapshot in `meta/versions/{timestamp}/`
- [x] If dry_run: return files that would change without applying
- [x] If not dry_run: generate code, apply changes, run tests
- [x] Log evolution to `meta/evolution_log.yaml` with files_changed, rollback_version, outcome
- [x] Update proposal status to "applied"
- [x] Return evolution_id, files_changed, rollback_version, tests_passed, status
- [x] UI: diff view of all file changes, Apply/Rollback buttons, test results panel, evolution history timeline

### `hive_rollback_evolution`
- [x] Tool handler: accept `evolution_id`
- [x] Read evolution entry from `meta/evolution_log.yaml`
- [x] Restore files from `meta/versions/{rollback_version}/`
- [x] Update evolution outcome to "rolled_back"
- [x] Return rolled_back status, files_restored, current_version

### `hive_evolution_history`
- [x] Tool handler: accept optional `limit` (default: 20)
- [x] Read `meta/evolution_log.yaml`
- [x] Return evolution entries with status, files changed, outcomes
- [x] UI: timeline visualization with expand for details, active in green, rolled-back in red

---

## Phase 12 — Revenue Engine

### Storage: Integrations + Revenue
- [x] `integrations/polar.yaml` schema — Polar.sh API key (via env var), connected products, sync frequency
- [x] `integrations/analytics.yaml` schema — analytics provider keys (Plausible/PostHog/Simple Analytics)
- [x] `revenue/snapshots/{date}.yaml` schema — daily MRR/ARR/churn/LTV across all products with plan breakdowns
- [x] `revenue/experiments/{id}.yaml` schema — A/B test definitions (hypothesis, variants, traffic splits, results, confidence)
- [x] `revenue/forecasts/{project}.yaml` schema — revenue projections

### `hive_revenue_dashboard`
- [x] Tool handler: accept optional `period` ("today" | "this_week" | "this_month" | "this_quarter" | "this_year"), `compare_to` ("previous_period" | "same_period_last_year")
- [x] Read `revenue/snapshots/` files, filter by period
- [x] Compute totals: total_mrr, total_arr, total_customers, mrr_change, mrr_change_pct
- [x] Per product: mrr, customers, churn_rate, ltv, trend, growth_rate, plan_breakdown, contribution_pct
- [x] Identify top_growing products and needs_attention items (with reasons)
- [x] Compute revenue_by_day array for charting
- [x] Return full dashboard payload
- [x] UI: hero MRR number with trend arrow, line chart (daily MRR), product breakdown table (sortable), "Needs Attention" alerts, contribution pie chart

### `hive_pricing_analysis`
- [x] Tool handler: accept `project`
- [x] Read revenue data for project (plans, customers, ARPU)
- [x] Analyze current pricing: plans with customer counts, average_revenue_per_user, price_sensitivity_signals
- [x] Generate recommendations: raise_price, lower_price, add_tier, remove_tier, change_limits — each with target, current, proposed, reasoning, estimated_impact (mrr_change, customer_change, confidence)
- [x] Compare against similar products' pricing from knowledge base
- [x] Return current_pricing, recommendations, competitor_context, similar_products_pricing
- [x] UI: current pricing cards, recommendation action cards with estimated impact mini-charts, "Run Experiment" button

### `hive_growth_signals`
- [x] Tool handler: accept optional `threshold` (minimum growth_rate change to flag, default: 5%)
- [x] Read all revenue snapshots, compute per-project growth trends
- [x] Classify products: accelerating (with signals), decelerating (with signals), stable
- [x] Generate recommendations: per-project action, reasoning, priority (high/medium/low)
- [x] Return accelerating, decelerating, stable lists + recommendations
- [x] UI: three-column layout — Accelerating (green), Decelerating (red), Stable (gray) with actionable recommendation cards

### `hive_run_experiment`
- [x] Tool handler: accept `project`, `type` ("pricing" | "landing_page" | "feature_flag"), `hypothesis`, `variants` (name, description, traffic_pct per variant), `duration_days`
- [x] Create experiment entry in `revenue/experiments/{id}.yaml` with status "created"
- [x] Return experiment_id, status, started, ends, tracking_instructions
- [x] UI: experiment builder form, live results dashboard with conversion bars, confidence meter, "Call Winner" button

### `hive_financial_summary`
- [x] Tool handler: accept optional `period` ("this_month" | "this_quarter" | "this_year" | "all_time")
- [x] Read all revenue files + expense files (from `business/expenses/` and `fleet/costs.yaml`)
- [x] Compute revenue breakdown: total, recurring, one_time
- [x] Compute expenses breakdown: total, hosting, apis, domains, tools
- [x] Compute profit, margin_pct, runway_months
- [x] Compute per-product revenue and cost
- [x] Identify most and least profitable products
- [x] Generate recommendations
- [x] Return full financial summary
- [x] UI: P&L summary card, revenue vs expenses bar chart, product profitability table, runway meter

---

## Phase 13 — Content & Marketing Engine

### Storage: Marketing Directory
- [x] `marketing/{project}/launch-playbook.yaml` schema — generated launch assets (landing page, readme, tweets, product hunt, email sequences, changelog)
- [x] `marketing/{project}/content-calendar.yaml` schema — scheduled content with status
- [x] `marketing/{project}/campaigns/{id}.yaml` schema — multi-channel campaigns with timeline and results
- [x] `marketing/{project}/assets/` — generated assets (landing-page.html, readme.md, changelog.md)
- [x] `marketing/analytics/content-performance.yaml` schema — traffic/conversion attribution per content piece
- [x] `marketing/analytics/messaging-effectiveness.yaml` schema — which messages resonated

### `hive_generate_launch`
- [x] Tool handler: accept `project`, optional `channels` ("landing_page" | "readme" | "tweets" | "product_hunt" | "email" | "all"), `tone` ("technical" | "casual" | "professional")
- [x] Read project architecture, decisions, and patterns for context
- [x] Generate landing page (HTML with sections sourced from architecture components)
- [x] Generate README content
- [x] Generate tweet thread (launch, problem, how it works, CTA)
- [x] Generate Product Hunt listing (tagline, description, first comment, maker story)
- [x] Generate email sequences (onboarding series)
- [x] Generate initial changelog
- [x] Save to `marketing/{project}/launch-playbook.yaml`
- [x] Return all generated assets with source attribution
- [x] UI: tabbed preview (Landing Page, README, Tweets, Product Hunt, Emails) with Edit/Approve/Publish buttons and source attribution badges

### `hive_generate_content`
- [x] Tool handler: accept `project`, `type` ("blog_post" | "tutorial" | "documentation" | "comparison" | "case_study"), optional `topic`, `target_keywords`
- [x] Read project architecture and codebase context
- [x] Generate content with title, body, meta (description, keywords, word count, reading time)
- [x] Extract code examples with source file attribution
- [x] Suggest internal links and publish date
- [x] Return full content object
- [x] UI: full article preview, SEO panel, code examples with "from: {source_file}" badges, "Publish to {CMS}" button

### `hive_marketing_dashboard`
- [x] Tool handler: accept optional `period` ("this_week" | "this_month" | "this_quarter"), `project`
- [x] Read `marketing/analytics/content-performance.yaml`
- [x] Compute totals: content pieces, impressions, clicks, conversions, revenue attributed
- [x] Identify best and underperforming content
- [x] Detect content gaps (days since last content per project, suggested content)
- [x] Analyze messaging insights (top converting angles, top channels)
- [x] Return full dashboard payload
- [x] UI: performance table with sparklines, content gaps as alert cards with "Generate Now" buttons, messaging insights section

### `hive_draft_campaign`
- [x] Tool handler: accept `project`, `brief`, `channels` ("email" | "twitter" | "blog" | "landing_page"), optional `duration_days`
- [x] Generate campaign timeline: per-day/channel content pieces with content and optional scheduled times
- [x] Compute total pieces and estimated reach
- [x] Generate tracking setup instructions
- [x] Save to `marketing/{project}/campaigns/{id}.yaml`
- [x] Return campaign_id, brief, timeline, total_pieces, estimated_reach, tracking_setup
- [x] UI: campaign timeline (Gantt-like), content cards on timeline, "Schedule All" button

### `hive_auto_changelog`
- [x] Tool handler: accept `project`, optional `since` (date or git ref), `format` ("keep-a-changelog" | "conventional" | "narrative")
- [x] Read git history, decision log, and architecture changes since the given point
- [x] Categorize changes: added, changed, fixed, removed
- [x] Generate highlights summary per version
- [x] Link entries to source commits and decisions
- [x] Return changelog entries array
- [x] UI: changelog preview with entries linked to source commits/decisions, "Publish" buttons

---

## Phase 14 — Business Operations

### Storage: Business Directory
- [x] `business/entity.yaml` schema — business name, type, EIN (env var), state, address, payment methods
- [x] `business/clients/{slug}.yaml` schema — client profiles with contact, billing (rate, terms, totals), projects, contracts
- [x] `business/invoices/{id}.yaml` schema — invoice records with line items, status (draft/sent/paid/overdue/cancelled), payment instructions
- [x] `business/contracts/templates/` — contract templates (saas-terms, freelance, privacy-policy, etc.)
- [x] `business/contracts/generated/{id}.yaml` schema — generated contracts with variables, signing status
- [x] `business/expenses/{year}/{month}.yaml` schema — categorized expenses by vendor + project
- [x] `business/compliance/{project}/audit.yaml` schema — last compliance scan results
- [x] `business/tax/{year}.yaml` schema — annual tax summary

### `hive_generate_invoice`
- [x] Tool handler: accept `client`, optional `project`, `line_items` (description, quantity, rate), `period` ("this_month" | "last_month" | custom date range)
- [x] Read client profile from `business/clients/{slug}.yaml` for billing terms/rates
- [x] If no line_items provided, auto-generate from project hours/deliverables
- [x] Compute subtotal, tax, total
- [x] Generate invoice ID (format "INV-{year}-{seq}")
- [x] Generate payment link if payment provider configured
- [x] Write to `business/invoices/{id}.yaml` with status "draft"
- [x] Return invoice_id, client, line_items, subtotal, tax, total, pdf_path, payment_link, status
- [x] UI: invoice preview with line item editor, "Send" button (PDF + email), payment status tracker

### `hive_financial_report`
- [x] Tool handler: accept `period` ("this_quarter" | "this_year" | "last_year" | "custom"), optional `start`, `end`, `format` ("summary" | "detailed" | "tax_ready")
- [x] Read all revenue files, expense files, invoice records
- [x] Compute revenue breakdown: total, by_type (recurring/one_time/consulting), by_project, by_client, by_month
- [x] Compute expenses breakdown: total, by_category, by_vendor, by_month
- [x] Compute profit: net, margin_pct, by_month
- [x] Compute tax estimates: estimated_liability, quarterly_payment_due, deductible_expenses, notes
- [x] Compute outstanding: unpaid invoices count, amount outstanding, overdue details
- [x] Return full financial report
- [x] UI: P&L statement, revenue/expense charts by month, tax estimate card, outstanding invoices alerts, "Export to CSV" / "Send to Accountant" buttons

### `hive_generate_contract`
- [x] Tool handler: accept `type` ("freelance" | "saas_terms" | "privacy_policy" | "terms_of_service" | "nda"), optional `client`, `project`, `customizations`
- [x] Read template from `business/contracts/templates/`
- [x] Auto-fill variables from business entity, client profile, and project context
- [x] Generate contract content with review notes
- [x] Write to `business/contracts/generated/{id}.yaml`
- [x] Return contract_id, type, content, variables_used, review_notes, pdf_path
- [x] UI: contract preview with highlighted auto-filled variables, review notes as callouts, "Download PDF" / "Send for Signature" buttons

### `hive_compliance_scan`
- [x] Tool handler: accept optional `project` (specific project, or scan all)
- [x] Scan projects for compliance issues: missing_privacy_policy, outdated_terms, no_cookie_consent, missing_gdpr_controls, no_contact_info, missing_accessibility
- [x] Classify each issue by severity (critical/warning/info) with description, fix, and auto_fixable flag
- [x] Identify compliant projects
- [x] Write results to `business/compliance/{project}/audit.yaml`
- [x] Return scanned count, issues array, compliant list, last_scan timestamp
- [x] UI: compliance grid (projects x categories), green/red per cell, "Auto-Fix" buttons, overall compliance score

### `hive_track_expense`
- [x] Tool handler: accept `vendor`, `amount`, `category` ("hosting" | "apis" | "domains" | "tools" | "hardware" | "travel" | "other"), optional `project`, `recurring`, `note`
- [x] Read or create `business/expenses/{year}/{month}.yaml`
- [x] Append expense item under the appropriate category
- [x] Update category and monthly totals
- [x] Write back
- [x] Return logged confirmation, monthly_total, category_total

### `hive_client_overview`
- [x] Tool handler: accept optional `status` ("active" | "inactive" | "all")
- [x] Read all client files from `business/clients/`
- [x] For each client: compute active_projects, total_invoiced, outstanding, overdue, last_invoice date, contract_status
- [x] Apply status filter
- [x] Return clients array with computed fields
- [x] UI: client table with status indicators, expand for details, "Create Invoice" button per client

---

## Phase 15 — Knowledge Marketplace

### Storage: Marketplace Directory
- [x] `marketplace/packages/{slug}/manifest.yaml` schema — metadata, pricing, version, source patterns, confidence, includes
- [x] `marketplace/packages/{slug}/contents/` — sanitized distributable files
- [x] `marketplace/packages/{slug}/preview.yaml` schema — public preview (description, file tree, pattern names, confidence scores, no source code)
- [x] `marketplace/packages/{slug}/analytics.yaml` schema — downloads, ratings, revenue
- [x] `marketplace/export-rules.yaml` schema — exportable rules, secrets exclusion patterns, sanitization rules, min confidence, min usage
- [x] `marketplace/storefront.yaml` schema — marketplace profile + settings

### `hive_package_pattern`
- [x] Tool handler: accept `patterns` (slug array), `name`, `description`, `pricing` (type, price, currency), optional `include_docs`, `include_decision_guide`
- [x] Read each pattern from knowledge base
- [x] Apply sanitization per `marketplace/export-rules.yaml` (strip secrets, exclude low-confidence, sanitize sensitive patterns)
- [x] Bundle into distributable package with manifest
- [x] Generate public preview (no source code)
- [x] Write to `marketplace/packages/{slug}/`
- [x] Return package_slug, manifest, files_included, files_sanitized, files_excluded, preview, warnings, ready_to_publish
- [x] UI: package builder wizard, file tree with sanitization indicators, confidence scores, "Publish" button

### `hive_package_stack`
- [x] Tool handler: accept `stack` (slug), `name`, `description`, `pricing`, optional `extras` (include_patterns, include_example_project, include_docs)
- [x] Read stack preset and all referenced patterns
- [x] Bundle stack config + patterns + optional example project and documentation
- [x] Generate setup guide, architecture overview, decision rationale
- [x] Apply sanitization rules
- [x] Write to `marketplace/packages/{slug}/`
- [x] Return package_slug, manifest, stack_config, patterns_included, example_project info, documentation, ready_to_publish
- [x] UI: stack overview card, included patterns gallery, example project file tree, "Test Build" button

### `hive_marketplace_dashboard`
- [x] Tool handler: accept optional `period`
- [x] Read all package manifests and analytics from `marketplace/packages/`
- [x] Compute totals: packages, downloads, revenue
- [x] Per package: slug, name, type, price, downloads, revenue, rating, trend, last_updated
- [x] Identify top performing packages and packages needing updates (with reasons)
- [x] Compute revenue_by_month
- [x] Analyze customer insights: top tags requested, frequent questions, suggested new packages
- [x] Return full dashboard payload
- [x] UI: revenue chart, package table, "Needs Update" alerts, customer insights panel, "Create New Package" button

### `hive_export_knowledge` (Enhanced — supersedes Phase 10 version)
- [x] Tool handler: accept `scope` (projects, patterns, stacks, tags arrays, or all), `format` ("hive_import" | "markdown" | "json" | "zip"), `sanitize` (boolean), optional `recipient` ("client" | "collaborator" | "public")
- [x] Collect knowledge matching scope criteria
- [x] If sanitize: apply `marketplace/export-rules.yaml` — strip secrets, exclude credentials, sanitize sensitive content
- [x] Adjust content based on recipient type (client gets less detail, public gets most sanitized)
- [x] Bundle into requested format
- [x] Generate sanitization report: secrets_removed, files_excluded, files_modified
- [x] Return exported counts (patterns, stacks, decisions, dependencies), file_path, sanitization_report
- [x] UI: export wizard — select scope, choose format, review sanitization, export

---

## Phase 16 — Hive Mesh

### Storage: Mesh Directory
- [x] `mesh/identity.yaml` schema — peer_id (public key based), display_name, public_key, specialties, reputation summary, joined date
- [x] `mesh/peers/{peer_id}.yaml` schema — known peers with specialties, reputation_score, patterns exchanged, trust_level (unknown/known/verified/trusted)
- [x] `mesh/shared/outbound/patterns/` — anonymized patterns shared to mesh (structure only, no source code)
- [x] `mesh/shared/outbound/anti-patterns/` — shared anti-patterns
- [x] `mesh/shared/outbound/benchmarks/` — shared stack benchmarks
- [x] `mesh/shared/inbound/patterns/` — knowledge received from mesh
- [x] `mesh/shared/inbound/anti-patterns/` — anti-patterns received from mesh
- [x] `mesh/shared/inbound/benchmarks/` — benchmarks received from mesh
- [x] `mesh/delegations/{id}.yaml` schema — A2A task delegations (sent + received) with status, request, result, cost
- [x] `mesh/reputation.yaml` schema — reputation score + history
- [x] `mesh/mesh-settings.yaml` schema — sharing preferences (what to share, accept, auto-merge)

### Privacy Model
- [x] NEVER shared: source code, project names/slugs, client info, business data, API keys/secrets, personal data
- [x] Shared (opt-in): pattern structure (file names, exports, interfaces), pattern metadata, anti-patterns, stack benchmarks, usage notes/gotchas
- [x] Anonymization: project refs replaced with generic IDs, code replaced with structural descriptions, timestamps randomized, peer identities pseudonymous

### `hive_mesh_connect`
- [x] Tool handler: accept `action` ("join" | "update_profile" | "status" | "disconnect"), optional `display_name`, `share_preferences` (share_patterns, share_anti_patterns, share_benchmarks, accept_delegations, auto_merge_anti_patterns)
- [x] If "join": generate peer identity (ed25519 keypair), create `mesh/identity.yaml`, detect specialties from project history
- [x] If "update_profile": update identity and sharing preferences
- [x] If "status": return current connection status, peer count, reputation
- [x] If "disconnect": mark as disconnected
- [x] Return peer_id, status, peers_discovered, your_reputation, specialties_detected, settings
- [x] UI: connection status card, specialty badges, toggle switches for sharing, peer count

### `hive_mesh_share`
- [x] Tool handler: accept `type` ("pattern" | "anti_pattern" | "benchmark"), `source` (slug), optional `anonymize` (default: true)
- [x] Read source knowledge from local registry
- [x] Apply anonymization: strip project names, replace code with structural descriptions, randomize timestamps
- [x] Apply export rules to ensure no secrets or sensitive content
- [x] Write to `mesh/shared/outbound/{type}s/`
- [x] Return shared_slug, type, anonymized status, sanitization_report (fields_removed, references_stripped, code_excluded), mesh_id, initial_visibility
- [x] UI: share wizard with anonymization preview, "Code is never shared" assurance badge

### `hive_mesh_insights`
- [x] Tool handler: accept optional `context` (project, tags, type: "patterns" | "anti_patterns" | "benchmarks" | "all")
- [x] Read inbound mesh knowledge from `mesh/shared/inbound/`
- [x] Filter by context (project stack, tags, type)
- [x] For patterns: match against your stack, include adoptions count, rating, source peer, compatibility flag
- [x] For anti-patterns: check if affected stack matches yours, include reporter count, severity, applies_to_you flag
- [x] For benchmarks: aggregate stack satisfaction, migration targets, pain points, praise
- [x] Generate recommendations based on mesh intelligence
- [x] Return relevant_patterns, anti_patterns_to_watch, stack_benchmarks, recommendations
- [x] UI: three-tab layout — Patterns (gallery with "Adopt" buttons), Anti-Patterns (warnings with "affects you" badges), Benchmarks (stack comparison table)

### `hive_mesh_delegate`
- [x] Tool handler: accept `description`, `required_specialties`, optional `budget_tokens`, `deadline`, `prefer_peer`
- [x] Search mesh peers for matching specialties and reputation
- [x] If preferred peer specified: check availability and match
- [x] Create delegation in `mesh/delegations/{id}.yaml` with status "searching" or "assigned"
- [x] Return delegation_id, status, assigned_to (peer_id, display_name, reputation, specialties, estimated_completion), alternatives
- [x] UI: delegation request form, progress tracker, result review with "Adopt Result" / "Reject" and quality rating

### `hive_mesh_reputation`
- [x] Tool handler: accept optional `peer_id` (default: self)
- [x] Read reputation data from `mesh/reputation.yaml` (or peer file for others)
- [x] Compute rank: newcomer, contributor, expert, authority (based on score thresholds)
- [x] Gather contributions: patterns_shared, adoptions_of_your_patterns, anti_patterns_contributed, delegations_completed, delegations_failed, average_rating_received
- [x] Read reputation history (date, event, reputation_change)
- [x] Return peer_id, display_name, reputation_score, rank, specialties, contributions, history
- [x] UI: reputation profile card with score gauge and rank badge, activity timeline
