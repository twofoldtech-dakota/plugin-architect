# Hive — Implementation Checklist

## Project Setup

- [ ] Initialize Node.js/TypeScript project (`package.json`, `tsconfig.json`)
- [ ] Install core dependencies: `@modelcontextprotocol/sdk`, `yaml`
- [ ] Install MCP Apps dependencies: `@modelcontextprotocol/ext-apps`
- [ ] Install UI tooling: `vite`, `vite-plugin-singlefile`, `preact` (or vanilla)
- [ ] Set up project structure:
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
- [ ] Create MCP server entry point (`src/server/index.ts`) with `@modelcontextprotocol/sdk`
- [ ] Build script to compile TypeScript + bundle UI views into single HTML files
- [ ] Verify server starts and registers with an MCP client (e.g., Claude Code)

## Storage Layer

- [ ] Implement `~/.hive/` directory initialization (create dirs on first run)
  - `config.yaml`, `ideas/`, `projects/`, `knowledge/patterns/`, `knowledge/dependencies/`, `knowledge/stacks/`, `templates/`
  - `fleet/`, `retrospectives/`, `metrics/`, `revenue/`, `maintenance/`
- [ ] YAML read helper — read and parse a `.yaml` file, return typed object
- [ ] YAML write helper — serialize object and write to `.yaml` file
- [ ] Slugify utility — convert names to URL-safe slugs for file names
- [ ] Auto-create parent directories when writing new files

## Shared UI Framework

- [ ] `src/ui/shared/styles.css` — shared theme that adapts to host context (dark/light mode via `ui/initialize`)
- [ ] `src/ui/shared/components.ts` — reusable UI primitives (cards, buttons, forms, tags, status badges)
- [ ] Vite config (`src/build/bundle.ts`) to bundle each view directory into a standalone single HTML file
- [ ] Host context adapter — receive `structuredContent` from tool results, call back via `tools/call`

---

## Phase 0 — Discovery

### `hive_capture_idea`
- [ ] Tool handler: accept `description`, optional `problem`, `audience`
- [ ] Generate slug from description
- [ ] Structure into idea schema: `name`, `slug`, `problem`, `audience`, `proposed_solution`, `assumptions[]`, `open_questions[]`, `status: "raw"`
- [ ] Write to `~/.hive/ideas/{slug}.yaml`
- [ ] Return structured content (the saved idea)
- [ ] UI: structured form with description, problem, audience fields + submit button

### `hive_evaluate_idea`
- [ ] Tool handler: accept `idea` (slug)
- [ ] Read idea from `~/.hive/ideas/{slug}.yaml`
- [ ] Generate evaluation structure:
  - `feasibility`: score (1-5), `has_patterns`, `known_stack`, `estimated_sessions`, `unknowns[]`
  - `competitive`: `exists_already`, `differentiator`, `references[]`
  - `scope`: `mvp_definition`, `mvp_components[]`, `deferred[]`, `full_vision`
  - `verdict`: "build" | "park" | "kill" | "needs_more_thinking"
  - `reasoning`
- [ ] Merge evaluation into the idea YAML, update status to "evaluated"
- [ ] Return structured evaluation
- [ ] UI: interactive scorecard with visual indicators, verdict buttons (Build / Park / Kill), MVP scope editor

### `hive_list_ideas`
- [ ] Tool handler: accept optional `status` filter
- [ ] Read all YAML files from `~/.hive/ideas/`
- [ ] Return summary list (name, slug, status, verdict if evaluated)
- [ ] UI: kanban board with columns for raw/evaluated/approved/parked/rejected, click to expand, drag to change status

### `hive_promote_idea`
- [ ] Tool handler: accept `idea` (slug)
- [ ] Read idea, verify it has been evaluated and verdict is "build"
- [ ] Call `hive_init_project` logic with idea's MVP scope
- [ ] Update idea status to "approved"
- [ ] Return confirmation with project details
- [ ] UI: confirmation card showing MVP scope, stack recommendation, "Create Project" button

---

## Phase 1 — Foundation

### `hive_init_project`
- [ ] Tool handler: accept `name`, `description`, optional `stack` (preset slug)
- [ ] Create `~/.hive/projects/{name}/` directory
- [ ] Create `architecture.yaml` with initial structure (project, description, created, updated, status, stack, components, data_flows, file_structure)
- [ ] Create empty `decisions.yaml` (`decisions: []`)
- [ ] Create empty `apis.yaml` (`apis: []`)
- [ ] If stack preset provided, read from `~/.hive/knowledge/stacks/{stack}.yaml` and pre-populate architecture
- [ ] Return full architecture doc

### `hive_get_architecture`
- [ ] Tool handler: accept `project` (slug)
- [ ] Read `~/.hive/projects/{project}/architecture.yaml`
- [ ] Read `~/.hive/projects/{project}/decisions.yaml`
- [ ] Return combined architecture + decisions
- [ ] UI: visual component diagram with data flows, clickable components showing details/files/dependencies

### `hive_update_architecture`
- [ ] Tool handler: accept `project`, `updates` (partial object), optional `reason`
- [ ] Read current architecture, deep-merge updates
- [ ] Update `updated` timestamp
- [ ] If `reason` provided, auto-log a decision via `hive_log_decision` logic
- [ ] Write updated architecture
- [ ] Return updated doc

### `hive_register_pattern`
- [ ] Tool handler: accept `name`, `description`, `tags[]`, `files[]` (path + content), optional `notes`
- [ ] Generate slug from name
- [ ] Write pattern to `~/.hive/knowledge/patterns/{slug}.yaml` with: name, description, tags, stack, verified: true, created date, used_in: [], files, notes
- [ ] Update `~/.hive/knowledge/patterns/index.yaml` — add entry with slug + tags
- [ ] Return confirmation
- [ ] UI: code preview with syntax highlighting, tag editor, save confirmation

### `hive_find_patterns`
- [ ] Tool handler: accept `query` (natural language or tags), optional `stack[]` filter
- [ ] Read `~/.hive/knowledge/patterns/index.yaml`
- [ ] Match by tags and keyword search against names/descriptions
- [ ] If `stack` filter provided, filter by stack field
- [ ] Read and return full content of matching patterns
- [ ] UI: pattern gallery with cards (name, tags, usage count), click to expand, "Apply to project" button

### `hive_register_dependency`
- [ ] Tool handler: accept `name`, `version`, `surface` (exports, types, signatures, gotchas), optional `source` (docs URL)
- [ ] Create `~/.hive/knowledge/dependencies/{name}/` directory
- [ ] Write `meta.yaml` with name, version, fetched date, source
- [ ] Write `surface.yaml` with exports, column_types, common_patterns, gotchas
- [ ] Return confirmation
- [ ] UI: API surface viewer with collapsible exports, signatures, highlighted gotchas

### `hive_check_dependency`
- [ ] Tool handler: accept `name`
- [ ] Check if `~/.hive/knowledge/dependencies/{name}/` exists
- [ ] If exists: read and return `surface.yaml` + `meta.yaml`
- [ ] If not: return "not registered — consider registering"
- [ ] UI: quick reference card with key exports, common patterns, gotchas; "Not registered" state with one-click register button

### `hive_register_api`
- [ ] Tool handler: accept `project`, `name`, `type` (internal/external), `base`, `endpoints[]`
- [ ] Read `~/.hive/projects/{project}/apis.yaml`
- [ ] Append or update API entry
- [ ] Write back to `apis.yaml`
- [ ] Return confirmation

---

## Phase 2 — Validation

### `hive_validate_against_spec`
- [ ] Tool handler: accept `project`, `action` (what Claude is about to do), optional `files[]`
- [ ] Read project architecture
- [ ] Compare proposed action/files against architecture components, file_structure, and dependencies
- [ ] Return `{ aligned: boolean, concerns: string[], suggestions: string[] }`
- [ ] UI: traffic light view — green (aligned), yellow (concerns), red (conflicts) with expandable details

### `hive_validate_code`
- [ ] Tool handler: accept `code`, `file_path`, `project`
- [ ] Parse imports from code
- [ ] Check imports against registered dependencies — flag unknown imports
- [ ] Check function signatures against registered dependency surfaces — flag wrong signatures
- [ ] Check against known gotchas from dependency surfaces
- [ ] Return `{ issues: Issue[], verified: boolean }`
- [ ] UI: issue list with severity indicators, expandable items with fix suggestions

### `hive_log_decision`
- [ ] Tool handler: accept `project`, `component`, `decision`, `reasoning`, optional `alternatives[]`, `revisit_when`
- [ ] Read `~/.hive/projects/{project}/decisions.yaml`
- [ ] Auto-increment ID (format "001", "002", etc.)
- [ ] Append decision entry with date
- [ ] Write back
- [ ] Return confirmation with decision ID
- [ ] UI: decision card with structured fields, auto-linked to component

### `hive_check_progress`
- [ ] Tool handler: accept `project`, `project_path` (path to actual codebase)
- [ ] Read project architecture (components with file globs)
- [ ] Scan `project_path` filesystem to check which files/directories exist
- [ ] Classify each component as built, in_progress, or missing
- [ ] Calculate coverage percentage
- [ ] Return `{ built[], in_progress[], missing[], coverage_pct }`
- [ ] UI: progress dashboard with component bars (built/in-progress/missing), overall coverage percentage

### `hive_evaluate_feature`
- [ ] Tool handler: accept `project`, `feature`, optional `reasoning`
- [ ] Read project architecture (goals, components, scope)
- [ ] Generate alignment analysis: score (1-5), supports_goals, irrelevant_to_goals, verdict (core/nice-to-have/bloat/distraction)
- [ ] Generate effort vs impact analysis: estimated_effort, estimated_impact, ratio
- [ ] Check for existing patterns that could accelerate the feature
- [ ] Generate tradeoffs: what_to_cut, complexity_added, maintenance_burden
- [ ] Return recommendation: "build it" | "defer it" | "cut it" | "simplify it" (with simplified_alternative if applicable)
- [ ] UI: effort/impact quadrant chart, feature plotted on grid, recommendation card with Build/Defer/Cut/Simplify actions

---

## Phase 3 — Acceleration

### `hive_scaffold_project`
- [ ] Tool handler: accept `name`, `stack` (preset slug), `output_path`
- [ ] Read stack preset from `~/.hive/knowledge/stacks/{stack}.yaml`
- [ ] Read all patterns referenced by the preset
- [ ] Generate `package.json` with production + dev dependencies from preset
- [ ] Create file structure from preset's `file_structure`
- [ ] Write pattern files into the project
- [ ] Call `hive_init_project` logic to create the Hive project entry
- [ ] Return list of created files
- [ ] UI: stack preview showing file tree, dependencies, patterns + "Scaffold" button

### `hive_add_feature`
- [ ] Tool handler: accept `project`, `feature` (natural language or pattern name), `project_path`
- [ ] Read project architecture
- [ ] Search patterns matching the feature
- [ ] Determine which files to create/modify based on matching patterns + architecture
- [ ] Return file operations (create/modify with content)

### `hive_snapshot_patterns`
- [ ] Tool handler: accept `project`, `project_path`, `files[]`, `name`, `tags[]`
- [ ] Read specified files from `project_path`
- [ ] Create pattern YAML with file contents
- [ ] Write to `~/.hive/knowledge/patterns/{slug}.yaml`
- [ ] Update pattern index
- [ ] Add project to pattern's `used_in` list
- [ ] Return confirmation

### `hive_search_knowledge`
- [ ] Tool handler: accept `query`
- [ ] Search across all knowledge types: patterns (index + content), dependencies (meta + surface), decisions (all projects), architectures (all projects)
- [ ] Rank results by relevance (tag match, keyword match in names/descriptions)
- [ ] Return ranked results with type labels
- [ ] UI: tabbed search results — Patterns / Dependencies / Decisions / Architectures, click to drill in

### Meta Tools
- [ ] `hive_list_projects` — read all dirs in `~/.hive/projects/`, return name + status + stack for each
- [ ] `hive_list_patterns` — read `~/.hive/knowledge/patterns/index.yaml`, return all with tags
- [ ] `hive_list_stacks` — read all files in `~/.hive/knowledge/stacks/`, return name + description + tags for each

---

## Phase 4 — Intelligence

- [ ] Auto-suggest patterns when starting a project with a similar stack to existing patterns
- [ ] Detect architecture drift — compare codebase files against architecture spec, flag divergence
- [ ] Surface relevant decisions from past projects when logging a new decision on a similar component
- [ ] Dependency staleness tracking — compare registered version against latest published version, flag outdated
- [ ] Pattern confidence scoring — track usage count across projects, surface high-confidence patterns first

---

## Phase 5 — Cross-Project Intelligence

- [ ] Pattern lineage — track version history of patterns as they evolve across projects
- [ ] Decision graph — connect related decisions across projects, surface "last time you chose X, here's why"
- [ ] Anti-pattern registry (`hive_register_antipattern`) — save what NOT to do with context
- [ ] Project similarity scoring — compare new idea against existing project architectures/stacks
- [ ] `hive_get_insights` — "what should I know before building another [type] system?"
- [ ] `hive_compare_projects` — side-by-side arch/stack/decision comparison
- [ ] `hive_suggest_stack` — recommend best stack based on project description + history

---

## Phase 6 — Autonomous Build Agent + A2A Protocol

- [ ] `hive_plan_build` — take product description, output phased build plan with tasks, dependencies, order
- [ ] `hive_execute_step` — orchestrate Claude Code to execute next step in the plan
- [ ] `hive_review_checkpoint` — show what's been built, ask for approval to continue
- [ ] `hive_resume_build` — session persistence across Claude Code sessions, track where left off
- [ ] `hive_rollback_step` — undo last build step (revert file changes)
- [ ] A2A integration — multi-agent coordination (planning agent → coding agent → testing agent)
- [ ] Visual checkpoint UI for build reviews

---

## Phase 7 — Product Lifecycle

### Storage: Per-Project Additions
- [ ] `deploy.yaml` schema — deploy target, command, directory, environment_vars, pre_deploy, history
- [ ] `health.yaml` schema — health check definitions (HTTP/command), result history
- [ ] `errors.yaml` schema — error entries with severity, count, resolution tracking, source_command
- [ ] `usage.yaml` schema — usage entries with trends, source_command
- [ ] `backlog.yaml` schema — typed/prioritized backlog items (bug/improvement/idea/maintenance)

### `hive_deploy`
- [ ] Tool handler: accept `project`, optional `dry_run` (default: true), optional `notes`
- [ ] Read `deploy.yaml` from project directory
- [ ] If dry_run: return the commands that would execute without running them
- [ ] If not dry_run: run pre_deploy commands, then deploy command in configured directory
- [ ] Record deploy result (id, date, status, duration, version, commit, url/error) to history
- [ ] Return deploy record with status
- [ ] UI: deploy history timeline with status indicators + dry-run preview

### `hive_check_health`
- [ ] Tool handler: accept `project`
- [ ] Read `health.yaml` from project directory
- [ ] If no health.yaml: return "not configured" with setup instructions
- [ ] Execute each check (HTTP request or shell command) with timeout
- [ ] Determine per-check status: green (ok), yellow (slow/degraded), red (failed)
- [ ] Compute overall status (worst individual status)
- [ ] Append result to health.yaml results
- [ ] Return traffic-light status per check + overall
- [ ] UI: traffic-light health dashboard with response times and error details

### `hive_get_errors`
- [ ] Tool handler: accept `project`, optional `severity`, `since`, `resolved` filters
- [ ] If source_command configured: run it to pull fresh errors, parse output, append new entries
- [ ] Read `errors.yaml` from project directory
- [ ] Apply filters (severity, date range, resolution status)
- [ ] Compute summary: total, by_severity breakdown, unresolved count
- [ ] Return filtered entries + summary
- [ ] UI: error list with severity badges, resolution tracking, source command status

### `hive_get_usage`
- [ ] Tool handler: accept `project`, optional `period` ("7d" | "30d" | "90d", default: "7d")
- [ ] If source_command configured: run it to pull fresh usage data
- [ ] Read `usage.yaml` from project directory
- [ ] Filter entries by period
- [ ] Compute trend: direction (up/down/flat), change_pct over period
- [ ] Compute summary: avg daily requests, avg daily visitors, avg error rate
- [ ] Update trend in usage.yaml
- [ ] Return entries + trend + summary
- [ ] UI: usage trend chart with period selector and summary stats

### `hive_add_to_backlog`
- [ ] Tool handler: accept `project`, `type` (bug/improvement/idea/maintenance), `title`, optional `description`, `priority` (default: "medium"), `source`
- [ ] Read or create `backlog.yaml` for project
- [ ] Auto-increment backlog item ID (format "bl-001")
- [ ] Set status to "open", created date to now
- [ ] Append item to backlog
- [ ] Write back
- [ ] Return created item with ID
- [ ] UI: backlog form with type/priority selectors + submit

### `hive_get_backlog`
- [ ] Tool handler: accept `project`, optional `type`, `priority`, `status` (default: "open") filters
- [ ] Read `backlog.yaml` from project directory
- [ ] Apply filters
- [ ] Compute summary: total, by_type breakdown, by_priority breakdown
- [ ] Return filtered items + summary
- [ ] UI: kanban backlog board with type/priority filters

### `hive_archive_project`
- [ ] Tool handler: accept `project`, optional `reason`
- [ ] Set project status to "archived" in architecture.yaml
- [ ] Log archival decision in decisions.yaml with reason
- [ ] Count preserved knowledge (patterns extracted, decisions logged, deps registered)
- [ ] Return confirmation with knowledge preservation summary
- [ ] UI: archive confirmation card showing preserved knowledge counts

---

## Phase 8 — Fleet Management

### Storage: Fleet Directory
- [ ] `fleet/topology.yaml` schema — hosts (provider, type, projects, specs), domains (registrar, DNS, expiry)
- [ ] `fleet/costs.yaml` schema — cost entries (name, category, provider, amount, period, projects), totals
- [ ] `fleet/priorities.yaml` schema — computed priority scores per project

### `hive_fleet_status`
- [ ] Tool handler: accept optional `include_archived` (default: false)
- [ ] Scan all project directories under `~/.hive/projects/`
- [ ] For each project: read architecture (status), health.yaml (overall), errors.yaml (recent count), usage.yaml (trend), deploy.yaml (last deploy)
- [ ] Read `fleet/costs.yaml` for per-project costs
- [ ] Read `revenue/` files for per-project revenue
- [ ] Aggregate into fleet summary: total projects, healthy/unhealthy count, total cost, total revenue
- [ ] Return per-project status cards + fleet summary
- [ ] UI: fleet dashboard with per-project health/status/cost cards

### `hive_fleet_scan_deps`
- [ ] Tool handler: accept optional `package` (specific package name), `severity` (minimum vulnerability severity)
- [ ] Read registered dependencies from `knowledge/dependencies/`
- [ ] Cross-reference with all project architecture files to find which projects use which deps
- [ ] Identify outdated packages (registered version vs known latest)
- [ ] Return outdated list (package, current version, latest, affected projects) + vulnerabilities if any
- [ ] UI: vulnerability/outdated table with affected project badges

### `hive_fleet_update_pattern`
- [ ] Tool handler: accept `pattern` (slug), optional `dry_run` (default: true)
- [ ] Read pattern from `knowledge/patterns/{slug}.yaml`
- [ ] Find all projects in pattern's `used_in` list
- [ ] For each project: determine files that would change, generate diff preview
- [ ] If dry_run: return affected projects + diff previews without modifying
- [ ] If not dry_run: apply changes, log update decision in each project's decisions.yaml
- [ ] Return affected projects list with applied status
- [ ] UI: diff preview per project with apply/skip controls

### `hive_fleet_costs`
- [ ] Tool handler: accept optional `group_by` ("project" | "category" | "provider", default: "project")
- [ ] Read `fleet/costs.yaml`
- [ ] Read all `revenue/` files
- [ ] Group costs by requested dimension
- [ ] Compute totals (monthly, yearly) and cost vs revenue comparison
- [ ] Return grouped breakdown + totals + net revenue
- [ ] UI: cost breakdown charts (bar/pie) with revenue comparison

### `hive_whats_next`
- [ ] Tool handler: accept optional `available_time` ("quick" | "session" | "deep", default: "session"), `focus` (area filter)
- [ ] Scan all projects: backlogs, errors, health, usage
- [ ] Score each potential action: critical errors (highest weight) > high backlog items > usage drops > maintenance > improvements
- [ ] Filter by available_time (quick = trivial/small tasks only, session = medium, deep = any)
- [ ] Filter by focus area if provided
- [ ] Return priority-scored recommendations with project, action, reason, score, effort, source
- [ ] UI: priority queue with action cards, effort estimates, source signals

---

## Phase 9 — Self-Improving Hive

### Storage: Retrospectives + Metrics
- [ ] `retrospectives/{project}.yaml` schema — build analysis with planning accuracy, pattern reuse, knowledge usage, lessons, scores
- [ ] `metrics/tool-usage.yaml` schema — Hive tool usage tracking
- [ ] `metrics/pattern-health.yaml` schema — pattern quality metrics (uses, modifications, staleness, confidence)
- [ ] `metrics/estimates.yaml` schema — historical estimate vs actual data

### `hive_retrospective`
- [ ] Tool handler: accept `project`
- [ ] Read project architecture (initial plan vs current state)
- [ ] Count planned vs actual components, compute scope change
- [ ] Read patterns used (from architecture + decisions), compute reuse rate
- [ ] Count pre-registered deps used, new deps added, decisions informed by history, hallucinations caught
- [ ] Generate lessons learned from decisions and scope changes
- [ ] Score 1-5: speed, quality, knowledge growth, compute overall
- [ ] Save to `~/.hive/retrospectives/{project}.yaml`
- [ ] Return full retrospective
- [ ] UI: retrospective scorecard with radar chart (speed/quality/knowledge growth) and lessons list

### `hive_knowledge_gaps`
- [ ] Tool handler: accept optional `scope` ("all" or project slug, default: "all")
- [ ] Scan all project architectures, decisions, and code patterns
- [ ] Cross-reference with registered patterns — find repeated code not captured as patterns
- [ ] Cross-reference with registered dependencies — find used but unregistered deps
- [ ] Identify potential anti-patterns from decision history (repeated "revisit_when" triggers, reverted decisions)
- [ ] Return unregistered patterns (with evidence + suggested name), unregistered deps, potential anti-patterns
- [ ] UI: gap list with one-click "register pattern" / "register dependency" actions

### `hive_pattern_health`
- [ ] Tool handler: accept optional `pattern` (specific slug, or all)
- [ ] Read all pattern files and their `used_in` lists
- [ ] For each pattern: count total uses, recent uses (30d), modifications after use
- [ ] Compute modification rate, staleness (fresh/aging/stale based on last use), confidence (high/medium/low)
- [ ] Generate recommendations (e.g., "consider splitting into variants" for high modification rate)
- [ ] Update `metrics/pattern-health.yaml`
- [ ] Return per-pattern health + summary (total, fresh/aging/stale counts, avg confidence)
- [ ] UI: pattern health dashboard with confidence indicators and staleness warnings

### `hive_estimate`
- [ ] Tool handler: accept `description`, optional `components` (count), `stack` (preset slug)
- [ ] Read `metrics/estimates.yaml` for historical data
- [ ] Compare description against all past project architectures for similarity scoring
- [ ] Factor in: pattern coverage (% of likely needs covered), stack familiarity (past use of this stack), scope complexity
- [ ] Compute estimated sessions based on similar projects' actual sessions, weighted by similarity
- [ ] Compute confidence level based on number of similar projects and historical accuracy
- [ ] Return estimate with similar projects, contributing factors, historical accuracy
- [ ] UI: estimate breakdown showing similar projects, confidence level, contributing factors

---

## Phase 10 — Sovereign Builder OS

### Storage: Revenue + Maintenance
- [ ] `revenue/{project}.yaml` schema — revenue model, entries (date, amount, customers, source), summary (MRR, total, trend)
- [ ] `maintenance/schedule.yaml` schema — maintenance rules (command/hive_tool, schedule, applies_to, auto_apply)
- [ ] `maintenance/log.yaml` schema — maintenance action history (date, rule, result, action_taken)

### `hive_idea_pipeline`
- [ ] Tool handler: accept optional `filter` ("raw" | "evaluated" | "all", default: "raw")
- [ ] Read all ideas from `~/.hive/ideas/`
- [ ] For each idea: score capability (how much can be built with existing patterns/knowledge)
- [ ] Score pattern coverage (% of likely needs covered by existing patterns)
- [ ] Estimate sessions based on similar past projects
- [ ] Compute priority score (weighted by feasibility + impact + effort)
- [ ] Return ranked ideas with scores and recommendations (build next / build soon / park / needs evaluation)
- [ ] UI: pipeline board with capability scores and priority rankings

### `hive_track_revenue`
- [ ] Tool handler: accept `project`, `action` ("add" | "query"), optional `entry` (for add), `period` (for query)
- [ ] If action is "add": read or create `revenue/{project}.yaml`, append entry, update summary (MRR, total, customers, trend)
- [ ] If action is "query": read revenue file, filter by period, return entries + summary
- [ ] Return entries + summary with MRR, total revenue, total customers, trend
- [ ] UI: revenue chart per project with MRR trend line

### `hive_fleet_revenue`
- [ ] Tool handler: accept optional `period` ("3m" | "6m" | "12m" | "all", default: "all")
- [ ] Read all `revenue/` files
- [ ] Read `fleet/costs.yaml`
- [ ] Compute per-project: MRR, monthly cost, net, customers, trend
- [ ] Compute fleet totals: total MRR, total cost, total net, total customers, profitable vs unprofitable count
- [ ] Return per-project P&L + fleet totals
- [ ] UI: fleet P&L dashboard with profitable/unprofitable indicators

### `hive_maintenance_run`
- [ ] Tool handler: accept optional `rule` (specific rule ID, or all), `dry_run` (default: true)
- [ ] Read `maintenance/schedule.yaml`
- [ ] If specific rule: filter to that rule; otherwise run all
- [ ] If dry_run: show what each rule would execute without running
- [ ] If not dry_run: execute each rule's command/tool, capture output
- [ ] Determine result status: ok / action_needed / failed
- [ ] If action_needed: optionally add items to relevant project backlogs
- [ ] Append results to `maintenance/log.yaml`
- [ ] Return per-rule results with status and actions taken
- [ ] UI: maintenance log with rule status, output, and action history

### `hive_build_from_description`
- [ ] Tool handler: accept `description` (natural language), optional `auto_approve` (default: false)
- [ ] Orchestrate existing tools in sequence:
  1. `hive_capture_idea` — structure the description into an idea
  2. `hive_evaluate_idea` — run feasibility check
  3. `hive_promote_idea` — create project if evaluation passes
  4. `hive_plan_build` — generate phased build plan
  5. `hive_execute_step` — begin building (if auto_approve)
- [ ] At each step: pause for approval if `auto_approve` is false
- [ ] Return pipeline status with current step + next action
- [ ] UI: pipeline wizard showing orchestration steps with approval gates

### `hive_export_knowledge`
- [ ] Tool handler: accept optional `scope` ("all" or categories array), `format` ("yaml" | "json", default: "yaml"), `output_path`
- [ ] Collect selected knowledge: patterns, dependencies, decisions, stacks, anti-patterns
- [ ] Bundle into a single file with metadata (export date, source Hive version, counts)
- [ ] Write to output_path (default: `~/.hive/exports/`)
- [ ] Return export summary (counts per category, file path, size)
- [ ] UI: export preview with category counts and format selector

### `hive_autonomy_status`
- [ ] Tool handler: accept `action` ("status" | "approve" | "reject" | "pause" | "resume"), optional `session_id`
- [ ] If "status": list all active/paused/awaiting build sessions with progress
- [ ] If "approve": resume paused session, execute pending action
- [ ] If "reject": roll back pending action, keep session paused
- [ ] If "pause": pause running session at next safe checkpoint
- [ ] If "resume": continue a paused session from where it left off
- [ ] Show risk level (low/medium/high) on pending approvals
- [ ] Return session list with status, progress, and pending approvals
- [ ] UI: session control panel with risk-level badges and approve/reject/pause/resume controls
