# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive is a personal knowledge-compounding MCP server with two responsibilities:
1. **Architecture Engine** — structured planning that stays in sync with code
2. **Knowledge Registry** — verified, queryable knowledge that eliminates hallucination

It serves as a knowledge layer for Claude Code (or any MCP client) that grows into a full build orchestrator over time.

## Current State

This repo is in the **planning phase** — it contains specs and roadmaps but no implementation code yet. The spec and roadmap live in `files/hive-spec.md` and `files/hive-roadmap.md`.

## Tech Stack (Planned)

- **Runtime:** Node.js / TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Storage:** YAML files (`yaml` package) in `~/.hive/`
- **No database** — flat YAML files, git-friendly

## Architecture

Hive stores all data under `~/.hive/` as YAML files organized into:
- `ideas/` — captured ideas with evaluations
- `projects/{slug}/` — per-project architecture docs, decisions, API contracts
- `knowledge/patterns/` — verified reusable code patterns
- `knowledge/dependencies/` — cached API surfaces for libraries
- `knowledge/stacks/` — full stack presets (e.g., "next-drizzle-sqlite")
- `templates/` — project/feature/component scaffolding templates

## Implementation Phases

The build is phased — each phase builds on the previous:

- **Phase 0 (Discovery):** Idea capture and evaluation tools (`hive_capture_idea`, `hive_evaluate_idea`, `hive_list_ideas`, `hive_promote_idea`)
- **Phase 1 (Foundation):** Storage layer, project/architecture management, pattern and dependency registration
- **Phase 2 (Validation):** Spec validation, code validation, decision logging, progress tracking, feature evaluation
- **Phase 3 (Acceleration):** Project scaffolding, feature assembly from patterns, knowledge search
- **Phase 4+ (Intelligence → Sovereign OS):** Auto-suggestions, autonomous build agent, fleet management, self-improvement

Phases 0 and 1 have no dependencies and should be built first. See `files/hive-roadmap.md` for the full roadmap.

## Key Design Decisions

- YAML over JSON for human readability and git-friendliness
- Flat files over database — personal use, no concurrent write pressure
- MCP tools expose all functionality — the server IS the interface
- Knowledge compounds: patterns extracted from projects feed into future projects
