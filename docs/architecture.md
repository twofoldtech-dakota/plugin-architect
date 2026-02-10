# Hive Architecture Guide

A developer-audience guide to how Hive is built and how to extend it.

## Overview

Hive is a Node.js MCP server with three layers:

```
┌─────────────────────────────────────────┐
│  MCP Client (Claude Desktop / Claude Code)  │
└────────────────────┬────────────────────┘
                     │ stdio
┌────────────────────┴────────────────────┐
│              MCP Server                  │
│  93 tools registered across 17 phases    │
│  8 UI views registered as MCP App resources │
└────────┬───────────────────┬────────────┘
         │                   │
┌────────┴────────┐ ┌───────┴───────────┐
│  YAML Storage   │ │  Bundled UI HTML  │
│  ~/.hive/       │ │  dist/ui/views/   │
└─────────────────┘ └───────────────────┘
```

- **Server** — TypeScript, uses `@modelcontextprotocol/sdk` for tool registration and stdio transport
- **Storage** — Flat YAML files in `~/.hive/`, no database
- **UI** — React views bundled into single HTML files with Vite, served as MCP App resources

## Server

### Entry point

`src/server/index.ts` creates the MCP server, registers all tools and UI resources, then connects via stdio:

```typescript
export function createServer(): McpServer {
  const server = new McpServer({ name: "hive", version: "0.5.0" });
  registerPhase0(server);  // Discovery
  registerPhase1(server);  // Foundation
  // ... through registerPhase16(server)
  registerUiResources(server);
  return server;
}
```

### Tool registration

Tools are organized by phase in `src/server/tools/`. Each tool file exports a `register*` function that calls `server.tool()` with a name, description, Zod schema, and handler:

```typescript
// src/server/tools/capture-idea.ts
export function registerCaptureIdea(server: McpServer): void {
  server.tool(
    "hive_capture_idea",
    "Capture a raw idea and structure it into an evaluable concept.",
    { description: z.string(), problem: z.string().optional(), /* ... */ },
    async ({ description, problem }) => { /* handler */ }
  );
}
```

Phase groupings are managed in `src/server/tools/index.ts`, which exports `registerPhase0()` through `registerPhase16()`. Each function registers all tools for that phase.

## Storage

### Directory structure

All data lives under `~/.hive/`. The full directory tree is defined in `src/server/storage/paths.ts` as the `HIVE_DIRS` constant:

| Path | Contents |
|------|----------|
| `ideas/` | Captured ideas as `{slug}.yaml` |
| `projects/{slug}/` | Per-project architecture, decisions, APIs, build plans, deploy config, health, backlog |
| `knowledge/patterns/` | Reusable code patterns |
| `knowledge/dependencies/` | Cached API surfaces for libraries |
| `knowledge/stacks/` | Stack presets (e.g., "next-drizzle-sqlite") |
| `knowledge/antipatterns/` | Things that didn't work |
| `fleet/` | Fleet-wide project status |
| `revenue/` | Revenue entries, snapshots, experiments, forecasts |
| `business/` | Clients, invoices, contracts, expenses, compliance, tax |
| `marketing/` | Content and campaign analytics |
| `marketplace/` | Packaged patterns and stacks |
| `mesh/` | Peer connections, shared knowledge (inbound/outbound) |
| `retrospectives/` | Build retrospective analyses |
| `meta/` | Self-audit telemetry and evolution proposals |
| `templates/` | Scaffolding templates |

### YAML helpers

`src/server/storage/yaml.ts` provides two functions:

- **`readYaml<T>(filePath)`** — Read and parse a YAML file, returns typed object
- **`writeYaml(filePath, data)`** — Serialize and write YAML, auto-creates parent directories

Both use the `yaml` package with `lineWidth: 120`.

### Slugify

`src/server/storage/slugify.ts` provides `slugify()` for converting names to filesystem-safe slugs used as directory/file names.

### Initialization

`initHiveDir()` in `src/server/storage/paths.ts` creates all directories on first run. Called once at startup in `main()`. Safe to call multiple times — only creates what's missing.

## UI System

### How views work

Each view is a standalone React app in `src/ui/views/{name}/`. Views are bundled into single HTML files (using `vite-plugin-singlefile`) and registered as MCP App resources.

The 8 views:

| View | Directory | Resource URI |
|------|-----------|-------------|
| Idea Scorecard | `src/ui/views/idea-scorecard/` | `ui://hive/idea-scorecard` |
| Idea Kanban | `src/ui/views/idea-kanban/` | `ui://hive/idea-kanban` |
| Architecture Viewer | `src/ui/views/architecture-viewer/` | `ui://hive/architecture-viewer` |
| Pattern Gallery | `src/ui/views/pattern-gallery/` | `ui://hive/pattern-gallery` |
| Progress Dashboard | `src/ui/views/progress-dashboard/` | `ui://hive/progress-dashboard` |
| Feature Evaluator | `src/ui/views/feature-evaluator/` | `ui://hive/feature-evaluator` |
| Scaffold Preview | `src/ui/views/scaffold-preview/` | `ui://hive/scaffold-preview` |
| Search Results | `src/ui/views/search-results/` | `ui://hive/search-results` |

### Resource registration

`src/server/ui-resources.ts` registers each bundled HTML file as an MCP App resource using `@modelcontextprotocol/ext-apps`:

```typescript
registerAppResource(server, `Hive ${name}`, `ui://hive/${name}`, { description }, async () => ({
  contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: readFileSync(htmlPath, "utf-8") }],
}));
```

Views that haven't been bundled yet are silently skipped.

### Shared components

`src/ui/shared/` contains reusable React components and types shared across all views:

- `react-components.tsx` — Shared UI component library (buttons, cards, badges, etc.)
- `types.ts` — TypeScript types for UI data

## Type System

15 type modules in `src/server/types/` define the data shapes for all Hive entities:

| Module | What it defines |
|--------|----------------|
| `idea.ts` | Idea, evaluation, verdict types |
| `architecture.ts` | Architecture doc, component, decision types |
| `pattern.ts` | Code pattern, tag, usage types |
| `dependency.ts` | Dependency surface, export, gotcha types |
| `antipattern.ts` | Anti-pattern types |
| `build-plan.ts` | Build plan, phase, task, checkpoint types |
| `lifecycle.ts` | Deploy, health check, error, usage, backlog types |
| `fleet.ts` | Fleet status, cost, priority types |
| `retrospective.ts` | Retrospective analysis, lesson types |
| `sovereign.ts` | Autonomy, maintenance, pipeline types |
| `meta.ts` | Self-audit, proposal, evolution types |
| `marketing.ts` | Content, campaign, analytics types |
| `business.ts` | Client, invoice, contract, expense types |
| `marketplace.ts` | Package, listing, marketplace types |
| `mesh.ts` | Peer, delegation, reputation types |

## Build Process

Two-stage build:

1. **TypeScript compilation** — `tsc` compiles `src/` to `dist/`
2. **UI bundling** — `node dist/build/bundle.js` runs Vite to bundle each view into a single HTML file

```bash
npm run build          # Both stages
npm run build:server   # TypeScript only
npm run build:ui       # UI bundling only
```

The UI bundler (`src/build/bundle.ts`) iterates over directories in `src/ui/views/`, runs Vite with `@vitejs/plugin-react` and `vite-plugin-singlefile` for each one, and outputs to `dist/ui/views/{name}/index.html`.

## How to add a new tool

1. **Create the tool file** — `src/server/tools/{tool-name}.ts`

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMyTool(server: McpServer): void {
  server.tool(
    "hive_my_tool",
    "Description of what this tool does",
    {
      param1: z.string().describe("What this param is for"),
    },
    async ({ param1 }) => {
      // Implementation
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
```

2. **Register in index.ts** — Import and add to the appropriate `registerPhaseN()` function in `src/server/tools/index.ts`

3. **Add types** (if needed) — Add type definitions to the relevant module in `src/server/types/`

4. **Build and test** — `npm run build && npm start`

## How to add a new UI view

1. **Create the view directory** — `src/ui/views/{view-name}/`

2. **Create `index.html`** — Entry point for Vite:

```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>View Name</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.tsx"></script>
</body>
</html>
```

3. **Create `index.tsx`** — React entry point:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  // Your view implementation
  return <div>...</div>;
}

createRoot(document.getElementById("root")!).render(<App />);
```

4. **Register the view** — Add the view name to the `VIEWS` array in `src/server/ui-resources.ts`

5. **Reference from a tool** — Return the resource URI `ui://hive/{view-name}` in your tool's response to trigger the view in Claude Desktop

6. **Build** — `npm run build` compiles TypeScript and bundles all views
