# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive is a personal knowledge-compounding MCP server with two responsibilities:
1. **Architecture Engine** — structured planning that stays in sync with code
2. **Knowledge Registry** — verified, queryable knowledge that eliminates hallucination

It serves as a knowledge layer for Claude Code (or any MCP client) that grows into a full build orchestrator over time.

## Current State

Hive is **implemented and functional** with 46 MCP tools across 10 categories, a SQLite storage layer, and 5 interactive UI views for Claude Desktop.

## Tech Stack

- **Runtime:** Node.js / TypeScript (strict mode, ES2022, Node16 modules)
- **MCP SDK:** `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` for UI views
- **Storage:** SQLite via `better-sqlite3` — single file at `~/.hive/hive.db`
- **UI:** React + Tailwind CSS, bundled with Vite + `vite-plugin-singlefile` into single HTML files
- **Validation:** Zod for tool input schemas
- **Transport:** stdio (default) or HTTP (`--http` flag)

## Architecture

### Storage

All data lives in `~/.hive/hive.db` (SQLite). The storage layer uses a repository pattern:

- `src/server/storage/db.ts` — database connection, schema DDL, JSON helpers
- `src/server/storage/paths.ts` — `HIVE_ROOT` and `DB_PATH` constants
- `src/server/storage/repos/` — one repo per domain (ideas, projects, decisions, patterns, dependencies, antipatterns, build, business)
- `src/server/storage/index.ts` — re-exports everything

### Tools

Each tool is a single file in `src/server/tools/` exporting a `register*` function that takes an `McpServer` instance. All tools are wired in `src/server/tools/index.ts`.

Categories:
- **Discovery** (4 tools): idea capture, evaluation, listing, promotion
- **Foundation** (10 tools): project init, architecture CRUD, patterns, dependencies
- **Validation** (4 tools): spec validation, code validation, progress checking
- **Acceleration** (3 tools): feature assembly, pattern snapshots, knowledge search
- **Intelligence** (5 tools): drift detection, pattern suggestions, staleness checks
- **Cross-Project** (6 tools): lineage, decision graphs, anti-patterns, insights
- **Build Agent** (5 tools): plan, execute, checkpoint, resume, rollback
- **Project Management** (3 tools): backlog, archiving
- **Revenue** (2 tools): revenue tracking, build-from-description pipeline
- **Business** (4 tools): invoicing, financial reports, expenses, client overview

### UI Views

5 React views bundled as single HTML files, registered as MCP App resources via `ui://hive/{name}`:
- `idea-scorecard`, `idea-kanban`, `architecture-viewer`, `pattern-gallery`, `search-results`
- Source: `src/ui/views/`, Build: `src/build/bundle.js`, Output: `dist/ui/views/`

### Entry Point

`src/server/index.ts` — creates the MCP server, registers all tools and UI resources, connects via stdio or HTTP transport.

## Build Commands

- `npm run build` — full build (TypeScript server + Vite UI views)
- `npm run build:server` — TypeScript only
- `npm run build:ui` — UI views only
- `npm run dev` — TypeScript watch mode

## Key Design Decisions

- SQLite over flat files — reliable, zero-config, single-file backup
- Repository pattern for data access — each domain gets its own repo
- One tool per file — easy to find, easy to extend
- MCP tools expose all functionality — the server IS the interface
- Knowledge compounds: patterns extracted from projects feed into future projects
