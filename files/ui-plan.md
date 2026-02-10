# Hive MCP Apps UI Views — Build Prompt

## Context

Hive is a personal MCP server that compounds knowledge across projects. The server is built and working with 41 tools returning structured JSON. The UI framework (shared CSS, component library, host adapter, Vite bundler with `vite-plugin-singlefile`) is built. What's missing: the actual UI view mini-apps for each tool.

Each view is a self-contained React app that:
1. Receives `structuredContent` (JSON) from the MCP tool result as props/data
2. Renders an interactive UI inside a sandboxed iframe (MCP Apps)
3. Can call back to Hive tools via `window.parent.postMessage` → host's `tools/call`
4. Adapts to host theme (dark/light) via CSS custom properties from `ui/initialize`

**Stack:** React (full, not Preact), TypeScript, Vite, `vite-plugin-singlefile` to bundle each view into a single HTML file.

## Project Structure

```
src/
  ui/
    shared/
      styles.css          # Already exists — shared theme with CSS custom properties
      components.tsx      # Already exists — reusable primitives (Button, Card, Badge, etc.)
      hooks.ts            # Create — shared hooks (useTheme, useToolCall, useStructuredContent)
      types.ts            # Create — shared TypeScript interfaces for all data models
    views/
      idea-scorecard/     # Phase 0 — hive_evaluate_idea
        index.tsx
        index.html        # Entry HTML that loads the React app
      idea-kanban/        # Phase 0 — hive_list_ideas
        index.tsx
        index.html
      architecture-viewer/ # Phase 1 — hive_get_architecture
        index.tsx
        index.html
      pattern-gallery/    # Phase 1 — hive_find_patterns
        index.tsx
        index.html
      progress-dashboard/ # Phase 2 — hive_check_progress
        index.tsx
        index.html
      feature-evaluator/  # Phase 2 — hive_evaluate_feature
        index.tsx
        index.html
      scaffold-preview/   # Phase 3 — hive_scaffold_project
        index.tsx
        index.html
      search-results/     # Phase 3 — hive_search_knowledge
        index.tsx
        index.html
  build/
    vite.views.config.ts  # Vite config that builds each view into dist/views/{name}.html
```

## Shared Infrastructure to Build First

### `src/ui/shared/hooks.ts`

```typescript
// useStructuredContent — parses structuredContent from MCP Apps host
// The host sends data via postMessage or injects it into the iframe context
export function useStructuredContent<T>(): T | null {
  // Listen for 'structuredContent' message from host
  // Also check window.__HIVE_DATA__ for SSR/testing
}

// useToolCall — calls a Hive MCP tool through the host
export function useToolCall() {
  return async (toolName: string, args: Record<string, unknown>) => {
    // postMessage to parent with { type: 'tools/call', tool: toolName, arguments: args }
    // Return promise that resolves when host responds
  };
}

// useTheme — reads CSS custom properties from host context
export function useTheme(): 'light' | 'dark' {
  // Check prefers-color-scheme and host-provided theme
}
```

### `src/ui/shared/types.ts`

All TypeScript interfaces for the data each view consumes. Define these based on the data models below.

---

## View 1: Idea Scorecard (`idea-scorecard/`)

**Tool:** `hive_evaluate_idea`
**Purpose:** Interactive scorecard showing feasibility, competitive analysis, and scope with a verdict.

### Data Model (structuredContent)

```typescript
interface IdeaEvaluation {
  idea: {
    name: string;
    slug: string;
    problem: string;
    audience: string;
    proposed_solution: string;
    assumptions: string[];
    open_questions: string[];
    status: 'raw' | 'evaluated' | 'approved' | 'rejected' | 'parked';
  };
  evaluation: {
    feasibility: {
      score: number;           // 1-5
      has_patterns: boolean;
      known_stack: boolean;
      estimated_sessions: number;
      unknowns: string[];
    };
    competitive: {
      exists_already: boolean;
      differentiator: string;
      references: string[];
    };
    scope: {
      mvp_definition: string;
      mvp_components: string[];
      deferred: string[];
      full_vision: string;
    };
    verdict: 'build' | 'park' | 'kill' | 'needs_more_thinking';
    reasoning: string;
  };
}
```

### UI Requirements

1. **Header** — Idea name, problem statement, audience
2. **Feasibility Section** — Score displayed as filled dots or bar (1-5). Badges for "Has Patterns" / "Known Stack". Estimated sessions as a number badge. Unknowns listed as warning chips.
3. **Competitive Section** — Exists already: yes/no indicator. Differentiator highlighted. References as linked pills.
4. **Scope Section** — MVP definition in a callout box. MVP components as green-tagged list. Deferred items as gray-tagged list. Full vision in a subtle expandable.
5. **Verdict Banner** — Large, color-coded verdict at the bottom:
   - `build` = green with checkmark
   - `park` = yellow with pause icon
   - `kill` = red with X
   - `needs_more_thinking` = blue with question mark
   - Reasoning text below the verdict
6. **Action Buttons** — "Promote to Project" (calls `hive_promote_idea`), "Change Verdict" dropdown, "Re-evaluate" (calls `hive_evaluate_idea` again)

### Design Notes
- This is the most important view — it's the gateway decision for every product
- The verdict should be immediately visible without scrolling
- Feasibility score should feel like a confidence meter, not just a number
- Use color intentionally: green = go signals, red = stop signals, yellow = caution

---

## View 2: Idea Kanban (`idea-kanban/`)

**Tool:** `hive_list_ideas`
**Purpose:** Kanban board showing all ideas organized by status.

### Data Model (structuredContent)

```typescript
interface IdeasList {
  ideas: Array<{
    name: string;
    slug: string;
    problem: string;
    audience: string;
    status: 'raw' | 'evaluated' | 'approved' | 'rejected' | 'parked';
    verdict?: 'build' | 'park' | 'kill' | 'needs_more_thinking';
    feasibility_score?: number;  // 1-5
    estimated_sessions?: number;
    created: string;             // ISO date
  }>;
}
```

### UI Requirements

1. **Kanban Columns** — One column per status: Raw, Evaluated, Approved, Parked, Rejected
2. **Idea Cards** — Each card shows: name (bold), problem (truncated), verdict badge (if evaluated), feasibility score dots, estimated sessions, created date
3. **Drag to Move** — Dragging a card between columns calls `hive_update_idea_status` (or equivalent tool) with the new status. Show a confirmation toast.
4. **Click to Expand** — Clicking a card opens an overlay/modal with full idea details (problem, audience, assumptions, open questions, full evaluation if exists)
5. **Quick Actions** — On each card: "Evaluate" button (for raw ideas), "Promote" button (for approved ideas)
6. **Column Counts** — Show count of ideas in each column header
7. **Empty State** — "No ideas yet. Start capturing with hive_capture_idea." with a subtle prompt.

### Design Notes
- Horizontal scrolling for columns on narrow viewports
- Cards should be compact — name + problem + key badges, nothing more
- Verdict badge colors match the scorecard: green/yellow/red/blue
- This is the "portfolio at a glance" view

---

## View 3: Architecture Viewer (`architecture-viewer/`)

**Tool:** `hive_get_architecture`
**Purpose:** Visual component diagram with data flows and interactive drill-down.

### Data Model (structuredContent)

```typescript
interface Architecture {
  project: string;
  description: string;
  status: 'ideation' | 'planning' | 'building' | 'shipping' | 'archived';
  stack: {
    runtime: string;
    framework: string;
    language: string;
    database: string;
    orm: string;
    hosting: string;
  };
  components: Array<{
    name: string;
    type: string;          // 'api-routes' | 'data-layer' | 'service' | 'ui' | etc.
    description: string;
    files: string[];
    dependencies: string[];  // names of other components
    schema?: {
      tables: Array<{
        name: string;
        columns: Array<{ name: string; type: string; primary?: boolean; unique?: boolean }>;
      }>;
    };
  }>;
  data_flows: Array<{
    name: string;
    steps: string[];
  }>;
  file_structure: Record<string, unknown>;   // nested directory tree
  decisions: Array<{
    id: string;
    date: string;
    component: string;
    decision: string;
    reasoning: string;
    alternatives_considered: string[];
    revisit_when: string;
  }>;
}
```

### UI Requirements

1. **Stack Banner** — Horizontal pill row showing: runtime, framework, language, database, orm, hosting. Project name + status badge.
2. **Component Graph** — Visual node graph where each component is a box. Boxes connected by arrows showing dependency relationships. Color-coded by type (api = blue, data = green, service = purple, ui = orange). Click a node to select it.
3. **Component Detail Panel** — When a component is selected, show: description, file patterns, dependencies list, schema tables (if data-layer). Slide-in panel on the right or expand below.
4. **Data Flows** — Below the graph, a section showing data flows. Each flow is an expandable row. When expanded, shows numbered steps as a vertical flow/timeline.
5. **File Structure** — Collapsible tree view of the project's file structure.
6. **Decisions Timeline** — Scrollable timeline of architectural decisions. Each decision card shows: component badge, decision text, reasoning (expandable), alternatives, revisit condition.

### Design Notes
- The component graph is the hero element — it should dominate the view
- For the graph, use a simple CSS-based layout (flexbox/grid positioning) rather than a full graph library — keep it lightweight. Position nodes in rows by dependency depth.
- Arrows can be SVG lines between nodes
- This is the "project brain" view — it should feel like looking at a blueprint

---

## View 4: Pattern Gallery (`pattern-gallery/`)

**Tool:** `hive_find_patterns`
**Purpose:** Browsable gallery of verified code patterns with search, filtering, and apply actions.

### Data Model (structuredContent)

```typescript
interface PatternSearchResults {
  query: string;
  results: Array<{
    name: string;
    slug: string;
    description: string;
    tags: string[];
    stack: string[];
    verified: boolean;
    created: string;
    used_in: string[];        // project slugs
    files: Array<{
      path: string;
      content: string;        // actual code
    }>;
    notes: string;
  }>;
}
```

### UI Requirements

1. **Search Bar** — Pre-filled with the current query. Typing and submitting calls `hive_find_patterns` with the new query.
2. **Filter Bar** — Filter by tags (multi-select chips), stack (dropdown), verified only (toggle)
3. **Pattern Cards** — Grid of cards, each showing:
   - Name (bold)
   - Description (1-2 lines)
   - Tags as colored pills
   - Stack badges
   - "Verified" checkmark badge
   - Usage count: "Used in N projects"
   - Click to expand
4. **Expanded Pattern View** — When a card is clicked, show full details:
   - All metadata
   - Code files with syntax highlighting (use a `<pre><code>` with CSS-based highlighting — no heavy library needed, just basic keyword coloring)
   - Notes section
   - "Apply to Project" button — calls `hive_add_feature` with this pattern
   - "Copy Code" button per file
5. **Empty State** — "No patterns match your search. Try different tags or a broader query."

### Design Notes
- This should feel like a component library browser (think Storybook catalog)
- Cards should show just enough to decide if you want to drill in
- Code preview: show first 5-10 lines on the card, full code on expand
- Usage count is a trust signal — higher usage = more proven

---

## View 5: Progress Dashboard (`progress-dashboard/`)

**Tool:** `hive_check_progress`
**Purpose:** Visual progress tracker comparing architecture spec vs actual codebase.

### Data Model (structuredContent)

```typescript
interface ProgressReport {
  project: string;
  coverage_pct: number;       // 0-100
  built: Array<{
    name: string;
    type: string;
    description: string;
    files_found: string[];
  }>;
  in_progress: Array<{
    name: string;
    type: string;
    description: string;
    files_found: string[];     // partial matches
    missing: string[];         // what's not done yet
  }>;
  missing: Array<{
    name: string;
    type: string;
    description: string;
    expected_files: string[];
  }>;
}
```

### UI Requirements

1. **Coverage Ring** — Large circular progress indicator showing overall coverage_pct. Color: green > 80%, yellow 50-80%, red < 50%. Number in the center.
2. **Status Summary** — Three stat cards in a row: "Built" (count, green), "In Progress" (count, yellow), "Missing" (count, red)
3. **Component Bars** — For each component, a horizontal bar showing status:
   - Green bar = built
   - Yellow bar = in progress (partially filled)
   - Red/gray bar = missing
   - Component name and type on the left
   - File count on the right
4. **Component Details** — Click a bar to expand and see:
   - For built: files found (green checkmarks)
   - For in_progress: files found (green) + missing files (red)
   - For missing: expected files (all red)
5. **Action Buttons** — "Build Next" button on missing components — suggests which to build next (calls Claude's attention to it)

### Design Notes
- Coverage ring should be the hero — visible immediately
- Think of this as a build radar
- The bars should be scannable — you should be able to see project health in 2 seconds
- Red items should feel urgent but not alarming

---

## View 6: Feature Evaluator (`feature-evaluator/`)

**Tool:** `hive_evaluate_feature`
**Purpose:** Effort/impact analysis with clear build/defer/cut/simplify recommendation.

### Data Model (structuredContent)

```typescript
interface FeatureEvaluation {
  feature: string;
  project: string;
  alignment: {
    score: number;               // 1-5
    project_goals: string[];
    supports_goals: string[];
    irrelevant_to_goals: string[];
    verdict: 'core' | 'nice-to-have' | 'bloat' | 'distraction';
  };
  effort_vs_impact: {
    estimated_effort: 'trivial' | 'small' | 'medium' | 'large';
    estimated_impact: 'critical' | 'high' | 'medium' | 'low';
    ratio: 'worth it' | 'questionable' | 'not worth it';
  };
  existing_patterns: {
    has_patterns: boolean;
    matching_patterns: string[];
    net_effort_with_patterns: string;
  };
  tradeoffs: {
    what_to_cut: string[];
    complexity_added: string;
    maintenance_burden: string;
  };
  recommendation: 'build it' | 'defer it' | 'cut it' | 'simplify it';
  simplified_alternative?: string;
}
```

### UI Requirements

1. **Feature Header** — Feature name, project name, recommendation badge (large, color-coded)
2. **Effort/Impact Quadrant** — 2x2 grid visualization:
   - X-axis: Effort (trivial → large)
   - Y-axis: Impact (low → critical)
   - Feature plotted as a dot on the quadrant
   - Quadrant labels: "Quick Win" (low effort, high impact), "Strategic" (high effort, high impact), "Fill-in" (low effort, low impact), "Avoid" (high effort, low impact)
3. **Alignment Section** — Score as filled dots (1-5). Project goals listed with green checkmarks for supported, gray dashes for irrelevant. Verdict badge.
4. **Pattern Boost** — If has_patterns: show matching patterns as clickable pills. "Net effort with patterns: {value}" — shows how much faster existing knowledge makes this.
5. **Tradeoffs Section** — What to cut (red items), complexity added (warning text), maintenance burden (info text)
6. **Recommendation Banner** — Bottom banner with the recommendation:
   - `build it` = green, "Go. This is aligned and worth the effort."
   - `defer it` = yellow, "Not now. Revisit after MVP."
   - `cut it` = red, "Drop it. Doesn't justify the cost."
   - `simplify it` = blue, shows the simplified_alternative in a callout
7. **Action Buttons** — "Accept Recommendation", "Override → Build Anyway", "Override → Cut"

### Design Notes
- The quadrant chart is the signature element of this view
- The recommendation should be impossible to miss
- This is a scope creep killer — make it feel decisive, not wishy-washy
- If the recommendation is "simplify it", the alternative should be prominently displayed

---

## View 7: Scaffold Preview (`scaffold-preview/`)

**Tool:** `hive_scaffold_project`
**Purpose:** Preview what a scaffold will create before generating it.

### Data Model (structuredContent)

```typescript
interface ScaffoldPreview {
  name: string;
  stack: {
    name: string;
    description: string;
    runtime: string;
    framework: string;
    language: string;
    database: string;
    orm: string;
  };
  files_to_create: Array<{
    path: string;
    description: string;
    from_pattern?: string;       // pattern slug if generated from a pattern
    content_preview?: string;    // first ~20 lines
  }>;
  dependencies: {
    production: string[];
    dev: string[];
  };
  patterns_applied: Array<{
    name: string;
    slug: string;
    files: string[];             // which files come from this pattern
  }>;
  scripts: Record<string, string>;  // package.json scripts
  estimated_files: number;
  estimated_loc: number;
}
```

### UI Requirements

1. **Stack Overview** — Stack name, description, tech pills (runtime, framework, language, db, orm)
2. **File Tree** — Collapsible tree showing all files to be created. Each file node shows:
   - File path
   - Description on hover/expand
   - Pattern badge if from a pattern (e.g., "from: drizzle-sqlite-setup")
   - Code preview on click (first ~20 lines in a code block)
3. **Dependencies Section** — Two columns: Production deps, Dev deps. Each as a list of package names with version badges.
4. **Patterns Applied** — Cards for each pattern being used, showing which files it generates. Click to see the pattern details.
5. **Stats Bar** — "N files · ~N lines of code · N patterns applied"
6. **Scaffold Button** — Large primary "Create Project" button at the bottom. Click calls `hive_scaffold_project` with the confirmed settings. Include an output path input field.

### Design Notes
- This should feel like a "before you confirm" review screen
- The file tree is the core — you should be able to see everything that will be created
- Pattern attribution is important — it shows how much is assembly vs new code
- Make it feel like you're about to press a button and a whole project appears

---

## View 8: Search Results (`search-results/`)

**Tool:** `hive_search_knowledge`
**Purpose:** Unified search results across all knowledge types with tabbed navigation.

### Data Model (structuredContent)

```typescript
interface SearchResults {
  query: string;
  total: number;
  results: {
    patterns: Array<{
      name: string;
      slug: string;
      description: string;
      tags: string[];
      used_in: string[];
      relevance: number;        // 0-1 score
    }>;
    dependencies: Array<{
      name: string;
      version: string;
      exports_count: number;
      gotchas_count: number;
      relevance: number;
    }>;
    decisions: Array<{
      id: string;
      project: string;
      component: string;
      decision: string;
      date: string;
      relevance: number;
    }>;
    architectures: Array<{
      project: string;
      description: string;
      status: string;
      stack_summary: string;     // e.g., "Next.js + Drizzle + SQLite"
      component_count: number;
      relevance: number;
    }>;
  };
}
```

### UI Requirements

1. **Search Bar** — Large, prominent. Pre-filled with current query. Submit re-searches.
2. **Tab Bar** — Tabs for: All ({total}), Patterns ({count}), Dependencies ({count}), Decisions ({count}), Architectures ({count}). Active tab highlighted.
3. **"All" Tab** — Interleaved results sorted by relevance. Each result has a type badge (Pattern / Dependency / Decision / Architecture) and type-specific preview:
   - Pattern: name, description, tags, usage count
   - Dependency: name, version, export count, gotcha count
   - Decision: project → component: decision text, date
   - Architecture: project name, stack summary, component count, status
4. **Type-Specific Tabs** — Filtered view showing only that type, with more detail per card
5. **Click Actions** — Each result is clickable:
   - Pattern → calls `hive_find_patterns` with the slug (or opens pattern gallery view)
   - Dependency → calls `hive_check_dependency` with the name
   - Decision → shows full decision details in an expandable card
   - Architecture → calls `hive_get_architecture` with the project
6. **Empty States** — Per-tab empty states: "No patterns match", "No dependencies found", etc.
7. **Relevance Indicator** — Subtle bar or dot color showing match strength

### Design Notes
- This is the "find anything" view — it should feel fast and scannable
- The "All" tab is the default and most important
- Type badges should use consistent colors: patterns = purple, deps = blue, decisions = orange, architectures = green
- Results should load and display instantly — no loading spinners for cached data

---

## Cross-Cutting Requirements

### Theme Adaptation
Every view must read CSS custom properties from the host:
```css
:root {
  --hive-bg: var(--host-bg, #ffffff);
  --hive-bg-secondary: var(--host-bg-secondary, #f5f5f5);
  --hive-text: var(--host-text, #1a1a1a);
  --hive-text-secondary: var(--host-text-secondary, #666666);
  --hive-accent: var(--host-accent, #6366f1);
  --hive-success: #22c55e;
  --hive-warning: #eab308;
  --hive-danger: #ef4444;
  --hive-info: #3b82f6;
  --hive-border: var(--host-border, #e5e5e5);
  --hive-radius: 8px;
}
```

### MCP Apps Integration Pattern
Each view's entry HTML should:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hive — {View Name}</title>
</head>
<body>
  <div id="root"></div>
  <!-- Vite injects the bundled JS/CSS here via vite-plugin-singlefile -->
</body>
</html>
```

### Tool Callback Pattern
When a button needs to call a Hive tool:
```typescript
const callTool = useToolCall();

const handlePromote = async () => {
  const result = await callTool('hive_promote_idea', { idea: slug });
  // Update local state with result
};
```

### Responsive Design
All views must work in iframe widths from 400px to 1200px. Use CSS container queries or responsive breakpoints. No horizontal scrolling except for the kanban board.

### Animation
Subtle transitions only: expand/collapse (200ms ease), hover states (150ms), drag feedback. No bounces, no springs, no loading shimmer.

### Accessibility
- All interactive elements keyboard accessible
- ARIA labels on icon-only buttons
- Color is never the only indicator (always paired with text or icon)
- Focus visible outlines

---

## Build Order

1. **Shared infrastructure** — `hooks.ts`, `types.ts`, verify Vite config builds each view
2. **Idea Scorecard** — highest value, most complex, sets the design language
3. **Idea Kanban** — pairs with scorecard, completes Phase 0
4. **Progress Dashboard** — simple data, high visual impact, validates the component bar pattern
5. **Feature Evaluator** — quadrant chart is the most unique UI element
6. **Architecture Viewer** — most complex view (graph rendering), defer if time-pressured
7. **Pattern Gallery** — familiar catalog pattern, straightforward
8. **Scaffold Preview** — file tree rendering, builds on patterns from architecture viewer
9. **Search Results** — tab pattern, aggregates all other views' card designs

## Testing

For each view, create a `__fixtures__/` directory with sample JSON data matching the structuredContent interface. Each view should be testable by:
1. Opening its HTML file directly in a browser
2. Having `window.__HIVE_DATA__` set to the fixture data
3. Rendering correctly without an MCP Apps host

This lets you develop and iterate on views without needing a live MCP client.