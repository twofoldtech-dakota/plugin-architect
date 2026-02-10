# Hive MCP Apps — Implementation Spec

## Executive Summary

Transform Hive from a text-only MCP server into an interactive visual command center that renders dashboards, progress trackers, pipeline boards, and project overviews directly inside Claude conversations using the MCP Apps extension (SEP-1865).

---

## Architecture Overview

### Current State (Text-Only)

```
User asks question → Claude calls Hive tool → JSON response → Claude writes text summary
                                                                 ↑
                                                          User never sees raw data
```

### Target State (MCP Apps)

```
User asks question → Claude calls Hive tool → JSON response + UI resource
                                                    ↓                ↓
                                          Claude writes summary   Interactive UI
                                                                  renders in iframe
                                                                  inside the chat
```

### How MCP Apps Work

1. **Tool declaration**: Tools include `_meta.ui.resourceUri` pointing to a `ui://` resource
2. **Resource serving**: Server serves bundled HTML/JS when the host requests the resource
3. **Sandboxed rendering**: Host renders HTML in a sandboxed iframe in the conversation
4. **Bidirectional communication**: UI ↔ Host communicate via JSON-RPC over `postMessage`

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| MCP Server | `@modelcontextprotocol/sdk` | Already using this for Hive |
| MCP Apps Extension | `@modelcontextprotocol/ext-apps` | Official SDK for UI resources |
| UI Framework | React + TypeScript | Best SDK support via `useApp()` hook |
| Bundler | Vite + `vite-plugin-singlefile` | Required — iframe needs single HTML file |
| Charts | Recharts or Chart.js | Lightweight, React-native charting |
| Styling | Tailwind CSS (bundled) | Utility-first, treeshakes to small bundle |
| Transport | StreamableHTTP (Express) | Required for remote MCP + Claude.ai custom connectors |

### Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "@modelcontextprotocol/ext-apps": "latest",
    "express": "^4.18",
    "cors": "^2.8"
  },
  "devDependencies": {
    "vite": "^6",
    "vite-plugin-singlefile": "^2",
    "react": "^19",
    "react-dom": "^19",
    "@types/react": "^19",
    "typescript": "^5.7",
    "tailwindcss": "^4",
    "recharts": "^2"
  }
}
```

---

## Project Structure

```
hive-mcp/
├── server.ts                    # MCP server — registers tools + resources
├── package.json
├── tsconfig.json
├── vite.config.ts               # Multi-entry Vite config
│
├── tools/                       # Existing Hive tool handlers
│   ├── ideas.ts
│   ├── projects.ts
│   ├── patterns.ts
│   ├── fleet.ts
│   ├── revenue.ts
│   └── ...
│
├── apps/                        # MCP App UI source (one per visual tool)
│   ├── fleet-dashboard/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── ProjectCard.tsx
│   │           ├── HealthIndicator.tsx
│   │           └── ErrorBadge.tsx
│   │
│   ├── idea-pipeline/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── KanbanBoard.tsx
│   │           ├── IdeaCard.tsx
│   │           └── VerdictBadge.tsx
│   │
│   ├── build-progress/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── PhaseTracker.tsx
│   │           ├── TaskList.tsx
│   │           └── ProgressBar.tsx
│   │
│   ├── revenue-dashboard/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── MRRChart.tsx
│   │           ├── ProductBreakdown.tsx
│   │           └── GrowthSignals.tsx
│   │
│   ├── project-overview/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── components/
│   │           ├── ArchitectureView.tsx
│   │           ├── DecisionTimeline.tsx
│   │           └── DependencyGraph.tsx
│   │
│   └── shared/                  # Shared UI components & utilities
│       ├── theme.ts             # Hive design tokens
│       ├── StatusBadge.tsx
│       ├── Sparkline.tsx
│       └── useHiveTool.ts       # Wrapper around app.callServerTool()
│
├── dist/                        # Vite build output (single-file HTML per app)
│   ├── fleet-dashboard.html
│   ├── idea-pipeline.html
│   ├── build-progress.html
│   ├── revenue-dashboard.html
│   └── project-overview.html
│
└── scripts/
    └── build-apps.sh            # Builds all apps via Vite
```

---

## Tool → App Mapping

### Tier 1: High-Value Visual Tools (Build First)

These tools return complex, multi-dimensional data that is significantly better as UI than text.

| Tool | App Name | UI Resource URI | What It Renders |
|------|----------|----------------|-----------------|
| `hive_fleet_status` | Fleet Dashboard | `ui://hive/fleet-dashboard` | Project cards with health dots, error counts, deploy status, usage sparklines, cost/revenue per project |
| `hive_idea_pipeline` | Idea Pipeline | `ui://hive/idea-pipeline` | Kanban board: columns for raw → evaluated → approved → building → shipped. Cards show name, verdict badge, feasibility score, estimated sessions |
| `hive_check_progress` | Build Progress | `ui://hive/build-progress` | Phase tracker with progress bars per phase, task checklist with status icons, file change log, overall completion percentage |
| `hive_revenue_dashboard` | Revenue Dashboard | `ui://hive/revenue-dashboard` | MRR/ARR line charts, per-product revenue bars, churn rate, LTV, period comparison delta indicators |
| `hive_get_architecture` | Project Overview | `ui://hive/project-overview` | Architecture component diagram, decision timeline, dependency list with staleness indicators, API registry |

### Tier 2: Medium-Value Visual Tools (Build Second)

| Tool | App Name | What It Renders |
|------|----------|-----------------|
| `hive_whats_next` | Priority Queue | Scored task cards with priority badges, time estimates, source labels |
| `hive_get_backlog` | Backlog Board | Filterable list grouped by type (bug/improvement/idea/maintenance) with priority colors |
| `hive_financial_summary` | P&L View | Revenue vs expenses stacked bar chart, margin percentage, runway indicator |
| `hive_pattern_health` | Pattern Health | Grid of pattern cards with confidence scores, usage counts, staleness warnings |
| `hive_knowledge_gaps` | Gap Radar | Categorized gap list with severity indicators and suggested actions |

### Tier 3: Text-Only Tools (No UI Needed)

These are write operations or simple lookups where Claude's text summary is the right interface.

- `hive_capture_idea` — write operation, confirmation is sufficient
- `hive_evaluate_idea` — write operation with verdict
- `hive_log_decision` — write operation
- `hive_register_pattern` — write operation
- `hive_register_dependency` — write operation
- `hive_validate_code` — returns pass/fail with details
- `hive_init_project` — write operation
- `hive_promote_idea` — write operation
- `hive_add_to_backlog` — write operation

---

## Server Implementation

### Registering a Tool with UI

```typescript
// server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

const server = new McpServer({
  name: "Hive",
  version: "2.0.0",
});

// --- Fleet Dashboard ---

const fleetDashboardUri = "ui://hive/fleet-dashboard";

registerAppTool(
  server,
  "hive_fleet_status",
  {
    title: "Fleet Status",
    description: "Get a fleet-wide status overview of all projects...",
    inputSchema: {
      type: "object",
      properties: {
        include_archived: {
          type: "boolean",
          default: false,
          description: "Include archived projects",
        },
      },
    },
    _meta: {
      ui: { resourceUri: fleetDashboardUri },
    },
  },
  async ({ include_archived }) => {
    // Existing Hive logic — returns fleet data
    const fleetData = await getFleetStatus(include_archived);

    return {
      // structuredContent is passed to the UI via app.ontoolresult
      structuredContent: {
        type: "resource",
        resource: {
          uri: fleetDashboardUri,
          mimeType: RESOURCE_MIME_TYPE,
        },
      },
      // text content is what Claude sees for its text response
      content: [
        {
          type: "text",
          text: JSON.stringify(fleetData),
        },
      ],
    };
  }
);

registerAppResource(
  server,
  fleetDashboardUri,
  fleetDashboardUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(
      path.join(import.meta.dirname, "dist", "fleet-dashboard.html"),
      "utf-8"
    );
    return {
      contents: [
        { uri: fleetDashboardUri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  }
);

// --- Repeat pattern for each Tier 1 app ---

// HTTP Transport (required for remote MCP / Claude.ai custom connectors)
const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3001, () => {
  console.log("Hive MCP server listening on http://localhost:3001/mcp");
});
```

### Dual Response Pattern

Every UI-enabled tool returns **both**:

1. **`content`** (text) — What Claude sees. Claude still gets the full JSON data and writes its text summary as before. Users without MCP Apps support still get a useful response.
2. **`structuredContent`** (resource reference) — What triggers the iframe render. The host fetches the UI resource and passes the tool result data to it.

This means **backward compatibility is preserved**. In clients that don't support MCP Apps, Hive works exactly as it does today.

---

## UI Implementation

### Shared App Shell

Every Hive app follows the same initialization pattern:

```typescript
// apps/shared/useHiveTool.ts
import { App } from "@modelcontextprotocol/ext-apps";
import { useState, useEffect, useCallback } from "react";

const app = new App({ name: "Hive", version: "2.0.0" });

export function useHiveApp<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c) => c.type === "text")?.text;
        if (text) {
          setData(JSON.parse(text));
        }
      } catch (e) {
        setError("Failed to parse tool result");
      } finally {
        setLoading(false);
      }
    };

    app.connect();
  }, []);

  const callTool = useCallback(
    async (name: string, args: Record<string, unknown> = {}) => {
      setLoading(true);
      try {
        const result = await app.callServerTool({ name, arguments: args });
        const text = result.content?.find((c) => c.type === "text")?.text;
        if (text) {
          const parsed = JSON.parse(text) as T;
          setData(parsed);
          return parsed;
        }
      } catch (e) {
        setError(`Tool call failed: ${e}`);
      } finally {
        setLoading(false);
      }
      return null;
    },
    []
  );

  return { data, loading, error, callTool };
}
```

### Fleet Dashboard App

```tsx
// apps/fleet-dashboard/src/App.tsx
import { useHiveApp } from "../../shared/useHiveTool";
import { ProjectCard } from "./components/ProjectCard";
import { HealthIndicator } from "./components/HealthIndicator";

interface FleetData {
  projects: Array<{
    name: string;
    slug: string;
    status: string;
    stack: string;
    health: { status: string; last_check: string };
    errors: { critical: number; error: number; warning: number };
    usage: { trend: string; requests_7d: number };
    deploy: { last_deploy: string; status: string };
    costs: { monthly: number };
    revenue: { monthly: number };
  }>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    total_monthly_cost: number;
    total_monthly_revenue: number;
  };
}

export default function FleetDashboard() {
  const { data, loading, error, callTool } = useHiveApp<FleetData>();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-zinc-400">Loading fleet status...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
        <p className="text-red-400">{error || "No data"}</p>
      </div>
    );
  }

  const { projects, summary } = data;

  return (
    <div className="bg-zinc-950 text-zinc-100 p-6 min-h-screen font-sans">
      {/* Summary Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Projects" value={summary.total} />
        <StatCard
          label="Healthy"
          value={summary.healthy}
          color="text-emerald-400"
        />
        <StatCard
          label="Degraded"
          value={summary.degraded}
          color="text-amber-400"
        />
        <StatCard
          label="Monthly Cost"
          value={`$${summary.total_monthly_cost}`}
          color="text-red-400"
        />
        <StatCard
          label="Monthly Revenue"
          value={`$${summary.total_monthly_revenue}`}
          color="text-emerald-400"
        />
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <ProjectCard
            key={project.slug}
            project={project}
            onDrillDown={() =>
              callTool("hive_get_architecture", { project: project.slug })
            }
          />
        ))}
      </div>

      {/* Refresh button — calls the tool again via MCP Apps bridge */}
      <button
        onClick={() => callTool("hive_fleet_status", { include_archived: false })}
        className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
      >
        Refresh
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-zinc-100",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
```

### Idea Pipeline App (Kanban)

```tsx
// apps/idea-pipeline/src/App.tsx
import { useHiveApp } from "../../shared/useHiveTool";

interface Idea {
  name: string;
  slug: string;
  status: string;
  verdict?: string;
  feasibility?: number;
  estimated_sessions?: number;
  description: string;
}

const COLUMNS = [
  { key: "raw", label: "Raw", color: "border-zinc-600" },
  { key: "evaluated", label: "Evaluated", color: "border-blue-600" },
  { key: "approved", label: "Approved", color: "border-emerald-600" },
  { key: "rejected", label: "Rejected", color: "border-red-600" },
  { key: "parked", label: "Parked", color: "border-amber-600" },
];

export default function IdeaPipeline() {
  const { data, loading } = useHiveApp<{ ideas: Idea[] }>();

  if (loading || !data) {
    return <div className="animate-pulse p-8 text-zinc-400">Loading ideas...</div>;
  }

  const grouped = COLUMNS.map((col) => ({
    ...col,
    ideas: data.ideas.filter((i) => i.status === col.key),
  }));

  return (
    <div className="bg-zinc-950 text-zinc-100 p-6 min-h-screen">
      <h2 className="text-lg font-semibold mb-4">Idea Pipeline</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {grouped.map((column) => (
          <div
            key={column.key}
            className={`flex-shrink-0 w-64 bg-zinc-900 rounded-lg border-t-2 ${column.color}`}
          >
            <div className="p-3 border-b border-zinc-800">
              <span className="text-sm font-medium">{column.label}</span>
              <span className="ml-2 text-xs text-zinc-500">
                {column.ideas.length}
              </span>
            </div>
            <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
              {column.ideas.map((idea) => (
                <IdeaCard key={idea.slug} idea={idea} />
              ))}
              {column.ideas.length === 0 && (
                <div className="text-xs text-zinc-600 p-2 text-center">
                  No ideas
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  const verdictColors: Record<string, string> = {
    build: "bg-emerald-900 text-emerald-300",
    park: "bg-amber-900 text-amber-300",
    kill: "bg-red-900 text-red-300",
    needs_more_thinking: "bg-blue-900 text-blue-300",
  };

  return (
    <div className="bg-zinc-800 rounded-md p-3 text-sm">
      <div className="font-medium">{idea.name}</div>
      <div className="text-xs text-zinc-400 mt-1 line-clamp-2">
        {idea.description}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {idea.verdict && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              verdictColors[idea.verdict] || "bg-zinc-700"
            }`}
          >
            {idea.verdict}
          </span>
        )}
        {idea.feasibility && (
          <span className="text-xs text-zinc-500">
            F:{idea.feasibility}/5
          </span>
        )}
        {idea.estimated_sessions && (
          <span className="text-xs text-zinc-500">
            ~{idea.estimated_sessions}s
          </span>
        )}
      </div>
    </div>
  );
}
```

---

## Build & Bundle Configuration

### Multi-Entry Vite Config

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const appName = process.env.APP;

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: appName ? `apps/${appName}` : undefined,
  build: {
    outDir: `../../dist`,
    emptyOutDir: false,
    rollupOptions: {
      input: appName ? `apps/${appName}/index.html` : undefined,
      output: {
        entryFileNames: `${appName}.js`,
      },
    },
  },
});
```

### Build Script

```bash
#!/bin/bash
# scripts/build-apps.sh

APPS=("fleet-dashboard" "idea-pipeline" "build-progress" "revenue-dashboard" "project-overview")

rm -rf dist/

for app in "${APPS[@]}"; do
  echo "Building $app..."
  APP=$app npx vite build
  # Rename output to match resource URIs
  mv "dist/index.html" "dist/$app.html" 2>/dev/null || true
done

echo "All apps built."
```

### Package Scripts

```json
{
  "scripts": {
    "build:apps": "bash scripts/build-apps.sh",
    "serve": "npx tsx server.ts",
    "dev": "npm run build:apps && npm run serve",
    "tunnel": "npx cloudflared tunnel --url http://localhost:3001"
  }
}
```

---

## Deployment & Connectivity

### Local Development (Claude Desktop)

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "hive": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### Remote Deployment (Claude.ai Custom Connector)

1. Deploy Hive MCP server to a host (Railway, Fly.io, VPS, etc.)
2. In Claude.ai → Settings → Connectors → Add Custom Connector
3. Enter the remote URL: `https://hive.yourdomain.com/mcp`
4. Claude.ai fetches UI resources from the remote server and renders them

### Development Tunnel (Quick Testing)

```bash
# Terminal 1: Run Hive
npm run dev

# Terminal 2: Expose to internet
npx cloudflared tunnel --url http://localhost:3001
# → Gives you https://random-name.trycloudflare.com
# → Add as custom connector in Claude.ai
```

---

## Interaction Patterns

### Pattern 1: Initial Load (Host-Pushed Data)

```
User: "Show me fleet status"
  → Claude calls hive_fleet_status
  → Server returns JSON data + structuredContent referencing ui://hive/fleet-dashboard
  → Host preloads fleet-dashboard.html
  → Host renders iframe
  → Host pushes tool result to iframe via app.ontoolresult
  → UI hydrates with fleet data
  → Claude also writes text summary alongside the visual
```

### Pattern 2: User Interaction (UI-Initiated Tool Calls)

```
User clicks "Refresh" button in fleet dashboard iframe
  → UI calls app.callServerTool({ name: "hive_fleet_status", arguments: {} })
  → Request goes through host → server → executes tool → returns result
  → UI receives result and re-renders
  → (No new Claude message — this is purely UI ↔ server)
```

### Pattern 3: Drill-Down (UI-Initiated Navigation)

```
User clicks a project card in fleet dashboard
  → UI calls app.callServerTool({ name: "hive_get_architecture", arguments: { project: "dx" } })
  → Result contains architecture data
  → UI renders project detail view inline (or could use app.sendFollowUpMessage() 
    to send a message to Claude asking for more detail)
```

### Pattern 4: Cross-App Actions

```
User sees a critical error in fleet dashboard → clicks "View Errors"
  → UI calls app.callServerTool({ name: "hive_get_errors", arguments: { project: "dx", severity: "critical" } })
  → UI renders error list in an expanded panel
  → User clicks "Add to Backlog" on an error
  → UI calls app.callServerTool({ name: "hive_add_to_backlog", arguments: { ... } })
  → UI shows confirmation toast
```

---

## Design System

### Hive Visual Language

```typescript
// apps/shared/theme.ts

export const colors = {
  // Backgrounds
  bg: {
    primary: "#09090b",   // zinc-950
    card: "#18181b",      // zinc-900
    elevated: "#27272a",  // zinc-800
  },
  // Status
  status: {
    healthy: "#34d399",   // emerald-400
    degraded: "#fbbf24",  // amber-400
    down: "#f87171",      // red-400
    unknown: "#a1a1aa",   // zinc-400
  },
  // Verdicts
  verdict: {
    build: "#34d399",
    park: "#fbbf24",
    kill: "#f87171",
    needs_more_thinking: "#60a5fa",
  },
  // Priorities
  priority: {
    critical: "#f87171",
    high: "#fb923c",
    medium: "#fbbf24",
    low: "#a1a1aa",
  },
  // Accent
  accent: "#a78bfa",      // violet-400 (Hive brand)
  text: {
    primary: "#f4f4f5",   // zinc-100
    secondary: "#a1a1aa", // zinc-400
    muted: "#71717a",     // zinc-500
  },
};

export const sizes = {
  iframe: {
    // Recommended dimensions for MCP Apps
    minHeight: 320,
    maxHeight: 600,
    // Width is controlled by the host (fills conversation column)
  },
};
```

### Component Palette

| Component | Purpose | Used In |
|-----------|---------|---------|
| `StatCard` | Single metric with label | Fleet Dashboard, Revenue |
| `ProjectCard` | Project summary with health/errors/costs | Fleet Dashboard |
| `IdeaCard` | Idea with verdict badge and scores | Pipeline |
| `ProgressBar` | Horizontal fill bar with percentage | Build Progress |
| `PhaseTracker` | Vertical timeline of build phases | Build Progress |
| `TaskRow` | Checkable task with status icon | Build Progress, Backlog |
| `Sparkline` | Tiny inline chart | Fleet Dashboard, Revenue |
| `StatusDot` | Colored dot for health status | Everywhere |
| `VerdictBadge` | Pill with verdict color | Pipeline, Evaluation |
| `PriorityBadge` | Pill with priority color | Backlog, What's Next |

---

## Build Phases

### Phase 1: Foundation (1-2 sessions)

- [ ] Migrate Hive MCP server from stdio to StreamableHTTP transport (Express)
- [ ] Install `@modelcontextprotocol/ext-apps`
- [ ] Set up Vite multi-app build pipeline
- [ ] Create shared `useHiveApp` hook and theme
- [ ] Build one proof-of-concept app (Fleet Dashboard)
- [ ] Test with cloudflared tunnel + Claude.ai custom connector
- [ ] Verify backward compatibility (text responses still work)

### Phase 2: Core Apps (2-3 sessions)

- [ ] Idea Pipeline (Kanban board)
- [ ] Build Progress (phase tracker + task list)
- [ ] Revenue Dashboard (MRR chart, product breakdown)
- [ ] Project Overview (architecture view, decision timeline)

### Phase 3: Interactions (1-2 sessions)

- [ ] Drill-down from Fleet Dashboard → Project Overview
- [ ] Refresh / re-fetch on all dashboards
- [ ] Cross-tool actions (error → backlog, idea → evaluate)
- [ ] `app.sendFollowUpMessage()` for asking Claude questions from within UI

### Phase 4: Polish (1 session)

- [ ] Loading skeletons and error states
- [ ] Responsive layout (conversation column varies in width)
- [ ] Dark mode consistency
- [ ] Performance: bundle size optimization (target <200KB per app)

---

## Migration Strategy

### Backward Compatibility

The key insight: **tools that gain UI still return `content` text**. Claude still gets the JSON data and writes a text summary. The UI is purely additive.

This means:
- **Claude Desktop without MCP Apps support** → still works (text only)
- **Claude Code** → still works (text only)
- **Cursor / other MCP clients** → still works (text only)
- **Claude.ai with MCP Apps** → gets both text AND interactive UI

### Incremental Rollout

You don't need to convert all tools at once. Start with `hive_fleet_status` as a proof of concept. If it works well, add more. Tools without `_meta.ui` continue working exactly as before.

### Server Transport Change

The biggest breaking change is moving from **stdio** to **StreamableHTTP**. MCP Apps require the server to be reachable over HTTP (for Claude.ai custom connectors). This means:

**Before:** Hive runs as a child process via stdio (works with Claude Desktop local config)
**After:** Hive runs as an HTTP server (works with both Claude Desktop URL config AND Claude.ai custom connectors)

Claude Desktop supports both. You'd change your config from:

```jsonc
// Before (stdio)
{
  "mcpServers": {
    "hive": {
      "command": "node",
      "args": ["path/to/hive/server.js"]
    }
  }
}

// After (HTTP)
{
  "mcpServers": {
    "hive": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

---

## Security Considerations

- All UI runs in **sandboxed iframes** — no access to Claude's DOM, cookies, or storage
- UI ↔ host communication is **auditable JSON-RPC** over `postMessage`
- Tool calls from the UI go through the host and are subject to **user consent**
- Hive data is local (YAML files on disk) — no sensitive data leaves your machine unless you deploy remotely
- For remote deployment: add authentication to the Express server (API key header, OAuth, etc.)

---

## Open Questions

1. **Bundle size budget** — How large can a single-file HTML get before hosts struggle? Target <200KB compressed per app. Recharts is ~150KB minified — may need to use Chart.js (~65KB) or lightweight alternatives.

2. **State management across tool calls** — If the user calls `hive_fleet_status`, sees the dashboard, then asks Claude a question, does the iframe persist? Need to test with Claude.ai. If it doesn't persist, every tool call re-renders from scratch (which is fine for dashboards but annoying for drill-down state).

3. **Multiple apps in one conversation** — Can Claude render multiple iframes (one per tool call)? Likely yes, since each tool call gets its own response block.

4. **SSE streaming** — Could the fleet dashboard subscribe to real-time updates? The MCP spec supports SSE transport but this may not work within the iframe sandbox. Defer to Phase 4.