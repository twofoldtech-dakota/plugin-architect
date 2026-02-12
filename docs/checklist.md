# Hive MCP Apps — Implementation Checklist

## Phase A: Foundation (parallel, no dependencies)

### A1. Tailwind CSS Integration
- [x] Install `tailwindcss@4`, `@tailwindcss/vite@4`
- [x] Create `src/ui/shared/tailwind.css` with `@import "tailwindcss"`, dark variant, and Hive theme tokens
- [x] Create `src/ui/shared/utils.ts` with `cn()` classnames helper
- [x] Modify `src/build/bundle.ts` — add `@tailwindcss/vite` plugin to Vite config
- [x] Verify build still works with existing views (both old CSS and Tailwind coexist)

### A2. StreamableHTTP Transport
- [x] Install `express`, `@types/express`, `cors`, `@types/cors`
- [x] Create `src/server/transport-http.ts` — Express app with per-session `StreamableHTTPServerTransport`
- [x] Modify `src/server/index.ts` — add `--http` mode selection in `main()`
- [x] Add `"start:http"` script to `package.json`
- [x] Test: `npm run start:http` listens on port 3100

### A3. Install Recharts
- [x] Install `recharts@2`
- [x] Verify it does not break existing build

---

## Phase B: Shared Component Migration (blocks all view work)

### B1. Migrate shared React components to Tailwind
- [x] Migrate `Card` component — `hive-card` → Tailwind utilities
- [x] Migrate `Button` component — `hive-btn` variants → Tailwind
- [x] Migrate `Badge` component — `hive-badge-{variant}` → Tailwind
- [x] Migrate `StatCard` component — `hive-stat-card` → Tailwind
- [x] Migrate `Modal` component — `hive-modal-overlay` → Tailwind
- [x] Migrate `LoadingState` / `EmptyState` / `ErrorState` → Tailwind
- [x] Migrate `TabBar` component → Tailwind
- [x] Migrate `Expandable` component → Tailwind
- [x] Migrate `CodeBlock` component → Tailwind
- [x] Migrate `FileTree` component → Tailwind
- [x] Migrate `Tag` component → Tailwind
- [x] Migrate `ScoreDots` component → Tailwind
- [x] Migrate `HBar` component → Tailwind
- [x] Migrate `TechPill` component → Tailwind
- [x] Migrate `SearchBar` component → Tailwind
- [x] Migrate `QuadrantChart` component → Tailwind (SVG stays as-is)
- [x] Migrate `ProgressRing` component → Tailwind (SVG stays as-is)
- [x] Add new `RefreshButton` shared component
- [x] Add new `SparkLine` shared component (minimal inline SVG)
- [x] Add new `StatusDot` shared component (health indicator)

### B2. Add new view types
- [x] Add `FleetDashboardData` type to `src/ui/shared/types.ts`
- [x] Add `RevenueDashboardData` type
- [x] Add `PriorityQueueData` type
- [x] Add `BacklogBoardData` type
- [x] Add `PnlViewData` type
- [x] Add `PatternHealthData` type
- [x] Add `GapRadarData` type
- [x] Re-export `ProjectStatusCard`, `BacklogItem` from server types

---

## Phase C: Rework 8 Existing Views to Tailwind

- [ ] C1: `scaffold-preview` — replace CSS imports with Tailwind, update classes
- [ ] C2: `search-results` — replace CSS imports with Tailwind, update classes
- [ ] C3: `idea-scorecard` — replace CSS imports with Tailwind, update classes
- [ ] C4: `feature-evaluator` — replace CSS imports with Tailwind, update classes
- [ ] C5: `pattern-gallery` — replace CSS imports with Tailwind, update classes
- [ ] C6: `progress-dashboard` — replace CSS imports with Tailwind, update classes
- [ ] C7: `architecture-viewer` — replace CSS imports with Tailwind, update classes
- [ ] C8: `idea-kanban` — replace CSS imports with Tailwind, update classes

---

## Phase D: New Tier 1 Views

### D1. Fleet Dashboard
- [ ] Create `src/ui/views/fleet-dashboard/index.html`
- [ ] Create `src/ui/views/fleet-dashboard/index.tsx`
  - [ ] 5 StatCards header (Total, Healthy, Unhealthy, Cost, Revenue)
  - [ ] Responsive project grid (1-3 columns)
  - [ ] ProjectCard: name, status badge, health dot, error count, usage trend, deploy date, cost/revenue
  - [ ] SparkLine for usage trend
  - [ ] "View Details" button → `sendMessage("Show architecture for {project}")`
  - [ ] Refresh button
- [ ] Convert `src/server/tools/fleet-status.ts` from `server.tool()` to `registerAppTool()`
  - [ ] Add `_meta: { ui: { resourceUri: "ui://hive/fleet-dashboard" } }`

### D2. Revenue Dashboard
- [ ] Create `src/ui/views/revenue-dashboard/index.html`
- [ ] Create `src/ui/views/revenue-dashboard/index.tsx`
  - [ ] 5 StatCards header (MRR, ARR, Customers, Churn, LTV)
  - [ ] Comparison callout (delta vs previous period)
  - [ ] Recharts `<LineChart>` for MRR over time from `revenue_by_day`
  - [ ] Recharts `<BarChart>` for per-product breakdown
  - [ ] Top Growing / Needs Attention sections
  - [ ] Period selector (TabBar) → `callTool("hive_revenue_dashboard", { period })`
  - [ ] Refresh button
- [ ] Convert `src/server/tools/revenue-dashboard.ts` from `server.tool()` to `registerAppTool()`

---

## Phase E: New Tier 2 Views

### E1. Priority Queue
- [ ] Create `src/ui/views/priority-queue/index.html` + `index.tsx`
  - [ ] Time filter tabs (Quick/Session/Deep) → `callTool()` on change
  - [ ] Scored task cards sorted by score
  - [ ] Effort/priority badges per card
  - [ ] Click card → `sendMessage("Work on: {action}")`
- [ ] Convert `src/server/tools/whats-next.ts` to `registerAppTool()`

### E2. Backlog Board
- [ ] Create `src/ui/views/backlog-board/index.html` + `index.tsx`
  - [ ] Filter controls: type dropdown, priority dropdown, status tabs
  - [ ] Items grouped by priority with color coding
  - [ ] Action buttons: "Mark done" via `callTool()`, "Add" via `sendMessage()`
- [ ] Convert `src/server/tools/get-backlog.ts` to `registerAppTool()`

### E3. P&L View
- [ ] Create `src/ui/views/pnl-view/index.html` + `index.tsx`
  - [ ] Revenue/Expenses/Profit/Margin StatCards
  - [ ] Recharts stacked `<BarChart>` (revenue vs expenses)
  - [ ] Expense breakdown horizontal bars
  - [ ] Per-product sortable table
  - [ ] Recommendations alert cards
  - [ ] Period selector tabs
- [ ] Convert `src/server/tools/financial-summary.ts` to `registerAppTool()`

### E4. Pattern Health
- [ ] Create `src/ui/views/pattern-health/index.html` + `index.tsx`
  - [ ] Summary row: Total, Fresh/Aging/Stale counts, Avg confidence
  - [ ] Responsive card grid with confidence/staleness badges
  - [ ] Filter tabs: All / Fresh / Aging / Stale
  - [ ] Expandable recommendations per card
- [ ] Convert `src/server/tools/pattern-health.ts` to `registerAppTool()`

### E5. Gap Radar
- [ ] Create `src/ui/views/gap-radar/index.html` + `index.tsx`
  - [ ] TabBar: Unregistered Patterns / Unregistered Deps / Potential Anti-patterns
  - [ ] Cards with evidence lists, project badges, severity indicators
  - [ ] "Register" action → `sendMessage("Register pattern {name}")`
- [ ] Convert `src/server/tools/knowledge-gaps.ts` to `registerAppTool()`

---

## Phase F: Integration & Cleanup

### F1. Update UI Resource Registry
- [ ] Add 7 new view names to `VIEWS` array in `src/server/ui-resources.ts`:
  - `fleet-dashboard`, `revenue-dashboard`, `priority-queue`, `backlog-board`, `pnl-view`, `pattern-health`, `gap-radar`

### F2. Cross-View Interactions
- [ ] Fleet Dashboard → "View Details" → `sendMessage()` triggers architecture view
- [ ] Fleet Dashboard → "Add Error to Backlog" → `callTool("hive_add_to_backlog", ...)`
- [ ] Pattern Health → click pattern → `callTool("hive_find_patterns", { query })`
- [ ] Gap Radar → "Register" → `sendMessage("Register pattern/dependency {name}")`
- [ ] Add RefreshButton to all dashboards

### F3. Remove Old CSS
- [ ] Delete `src/ui/shared/styles.css`
- [ ] Delete `src/ui/shared/components.css`
- [ ] Delete `src/ui/shared/components.ts` (vanilla DOM helpers)
- [ ] Verify no remaining imports of deleted files

---

## Verification

- [ ] `npm run build` succeeds — all 15 views bundle as single-file HTML
- [ ] Bundle size: each view under 200KB (`ls -la dist/ui/views/*/index.html`)
- [ ] Stdio mode: `npm run start` works as before (backward compatible)
- [ ] HTTP mode: `npm run start:http` listens on port 3100
- [ ] MCP Inspector: call tools → verify JSON response + UI resource reference
- [ ] Dark mode: all views respect dark variant
- [ ] Cross-view interactions: drill-down, refresh, and cross-tool actions work
