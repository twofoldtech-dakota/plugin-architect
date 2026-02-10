# Hive MCP Apps UI Views — Living Document

> **Status:** Reflects current implementation as of 2026-02-10.
> This is a living document that tracks the actual state of the UI views.

## Architecture

Each view is a self-contained React app that:
1. Receives `structuredContent` (JSON) from the MCP tool result via `useHiveApp<T>()` hook
2. Renders an interactive UI inside a sandboxed iframe (MCP Apps)
3. Can call back to Hive tools via `callTool()` and send chat messages via `sendMessage()`
4. Adapts to host theme (dark/light) via CSS custom properties from `ui/initialize`

**Stack:** React, TypeScript, Vite, `vite-plugin-singlefile` to bundle each view into a single HTML file.

## Project Structure

```
src/ui/
  shared/
    styles.css              # Theme with CSS custom properties
    components.css          # Component-specific styles
    react-components.tsx    # 19 reusable primitives (Card, Badge, Button, etc.)
    hooks.ts                # useHiveApp<T>() — typed data, loading, tools, messages
    types.ts                # TypeScript interfaces matching tool return shapes
  views/
    idea-scorecard/         # hive_evaluate_idea
    idea-kanban/            # hive_list_ideas
    architecture-viewer/    # hive_get_architecture
    pattern-gallery/        # hive_find_patterns
    progress-dashboard/     # hive_check_progress
    feature-evaluator/      # hive_evaluate_feature
    scaffold-preview/       # hive_scaffold_project (result view, not preview)
    search-results/         # hive_search_knowledge
```

---

## View 1: Idea Scorecard (`idea-scorecard/`)

**Tool:** `hive_evaluate_idea`

### Data Model

```typescript
interface IdeaEvaluationData {
  idea: {
    name: string;
    slug: string;
    problem: string;
    audience: string;
    status: string;
  };
  evaluation: Evaluation; // feasibility, competitive, scope, verdict, reasoning
}
```

### Implemented Features
- Header with idea name, slug, problem statement, and audience
- Color-coded verdict banner (build=green, park=yellow, kill=red, needs_more_thinking=blue)
- Feasibility section: score dots (1-5), pattern/stack badges, estimated sessions, unknowns
- Competitive landscape: exists already badge, differentiator, references
- Scope section: MVP definition, components, deferred items, full vision (expandable)
- Action bar: "Promote to Project" (calls `hive_promote_idea`), "Change Verdict" dropdown, "Re-evaluate" button

### Deferred
- Drag-and-drop reordering of scope items

---

## View 2: Idea Kanban (`idea-kanban/`)

**Tool:** `hive_list_ideas`

### Data Model

```typescript
interface IdeaListItem {
  name: string;
  slug: string;
  status: string;
  problem: string;
  audience?: string;
  verdict?: string;
  feasibility_score?: number;
  estimated_sessions?: number;
  created: string;
}
```

### Implemented Features
- 5 kanban columns: Raw, Evaluated, Approved, Parked, Rejected
- Cards show: name, problem, verdict badge, feasibility score dots, estimated sessions badge
- "Evaluate" button on raw idea cards (sends chat message)
- "Promote" button on approved idea cards (calls `hive_promote_idea`)
- Click to open detail modal with problem, audience, slug, created date
- Column item counts

### Deferred
- Drag-to-move between columns (would need `hive_update_idea_status` tool)

---

## View 3: Architecture Viewer (`architecture-viewer/`)

**Tool:** `hive_get_architecture`

### Data Model

Uses `Architecture` and `Decision[]` from server types directly.

### Implemented Features
- Header with project name and status badge
- Stack banner with tech pills
- Component cards grid — clickable to expand detail panel showing:
  - File patterns list
  - Dependency badges
  - Schema tables (if data-layer component)
- Data flows as expandable timelines with numbered steps
- File structure as recursive tree
- Decisions timeline sorted by date with reasoning, alternatives, revisit conditions

### Deferred
- SVG dependency arrows between component cards
- Full graph layout by dependency depth

---

## View 4: Pattern Gallery (`pattern-gallery/`)

**Tool:** `hive_find_patterns`

### Data Model

`Pattern[]` from server types.

### Implemented Features
- Search bar (re-searches via `hive_find_patterns`)
- Tag filter chips (multi-select)
- Pattern cards with: name, verified badge, usage count, description, tags, code preview (3 lines)
- Detail modal: full metadata, code files with copy button, notes, stack, used_in projects
- "Apply Pattern" button — prompts for project slug, calls `hive_add_feature`

### Deferred
- Verified-only toggle filter
- Stack dropdown filter

---

## View 5: Progress Dashboard (`progress-dashboard/`)

**Tool:** `hive_check_progress`

### Data Model

```typescript
interface ProgressData {
  project: string;
  built: ComponentProgress[];
  in_progress: ComponentProgress[];
  missing: ComponentProgress[];
  coverage_pct: number;
}

interface ComponentProgress {
  name: string;
  type: string;
  description: string;
  status: "built" | "in_progress" | "missing";
  expected_files: string[];
  found_files: string[];
  missing_files: string[];
}
```

### Implemented Features
- Page title shows project name ("Build Progress — {project}")
- Coverage ring (120px) with color coding (green >80%, yellow 50-80%, red <50%)
- Stats row: Built, In Progress, Missing counts
- Component sections with expandable detail panels showing:
  - Component description
  - Progress bar (found/expected files)
  - Found files list (green) and missing files list (red)
- "Build Next" button on first missing component (sends chat message)

---

## View 6: Feature Evaluator (`feature-evaluator/`)

**Tool:** `hive_evaluate_feature`

### Data Model

```typescript
interface FeatureEvaluationData {
  feature: string;
  alignment: { score: number; classification: string; supports_goals: string[]; irrelevant_to_goals: string[] };
  effort_impact: { estimated_effort: "low"|"medium"|"high"; estimated_impact: "low"|"medium"|"high"; ratio: "favorable"|"neutral"|"unfavorable" };
  matching_patterns: string[];
  tradeoffs: { complexity_added: string; maintenance_burden: string; what_to_cut?: string };
  recommendation: { verdict: string; reasoning: string; simplified_alternative?: string };
}
```

### Implemented Features
- Feature name header
- Color-coded recommendation banner with reasoning and simplified alternative
- Effort vs Impact quadrant chart with effort/impact/ratio badges
- Alignment section: score dots, classification badge, supports/irrelevant goals
- Pattern boost section with matching patterns
- Tradeoffs section: complexity, maintenance burden, what to cut
- Action bar: "Accept Recommendation", "Override: Build Anyway", "Override: Cut"

### Design Notes
- Effort/impact uses `low/medium/high` scale (not `trivial/small/medium/large`)
- Ratio uses `favorable/neutral/unfavorable` (not `worth it/questionable/not worth it`)

---

## View 7: Scaffold Preview (`scaffold-preview/`)

**Tool:** `hive_scaffold_project`

> Note: This is a **result view** displayed after scaffolding completes, not a preview before scaffolding.

### Data Model

```typescript
interface ScaffoldData {
  message: string;
  project_path: string;
  hive_project: string;
  stack?: { name: string; description: string };
  files_created: number;
  files: Array<{ path: string; type: "file" | "directory" }>;
}
```

### Implemented Features
- Success header with badge
- Stack info display (name and description as TechPill)
- Stats bar: files created, Hive project slug, total entries
- Copyable project path
- File tree showing created files with directory/file icons

### Deferred
- Dependencies section (production vs dev)
- Pattern attribution badges on files

---

## View 8: Search Results (`search-results/`)

**Tool:** `hive_search_knowledge`

### Data Model

```typescript
interface SearchResultsData {
  query: string;
  total_results: number;
  results: Array<{
    type: "pattern" | "dependency" | "decision" | "architecture";
    name: string;
    relevance: number; // 0-1
    summary: string;
    data: unknown;
  }>;
}
```

### Implemented Features
- Query display with result count
- Re-search bar
- Tab bar with type counts (All, Patterns, Dependencies, Decisions, Architectures)
- Type-specific detail rendering:
  - **Pattern**: tags, used_in projects, verified badge
  - **Dependency**: version, export count
  - **Decision**: project badge, component badge, date, reasoning
  - **Architecture**: status badge, stack summary, component count
- Clickable results: patterns call `hive_find_patterns`, architectures call `hive_get_architecture`
- Relevance score dots with color coding

---

## Testing

Each view has a `__fixtures__/sample.json` with representative data. To test:
1. Open any view's built `dist/ui/views/{name}/index.html` in a browser
2. Open dev console and set `window.__HIVE_DATA__` to the fixture data
3. Refresh — the view should render correctly without an MCP Apps host

---

## Shared Components

19 reusable components in `react-components.tsx`:
- **Layout**: Card, Modal, TabBar, Expandable
- **Input**: Button, SearchBar, Badge, Tag
- **Data Viz**: ScoreDots, ProgressRing, StatCard, HBar, TechPill, QuadrantChart
- **Lists**: FileTree (accepts string[] or {path, type}[]), CodeBlock (with copy)
- **States**: LoadingState, EmptyState, ErrorState
