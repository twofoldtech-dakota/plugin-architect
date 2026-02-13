# Hive

An MCP server that remembers how you build — so every project starts smarter than the last.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)

## What is Hive?

Every new project starts from zero. You've solved auth, set up databases, configured deploys a dozen times. That knowledge lives scattered across old repos you'll never search through again. Meanwhile, your AI assistant hallucinates API signatures and suggests patterns you abandoned two projects ago.

Hive is an MCP server that captures your architecture decisions, code patterns, and project knowledge in one queryable place. Register a pattern once, and it's available for every future project. Log a decision, and Hive surfaces it the next time you face the same choice. Cache a dependency's real API surface, and Claude stops guessing at function signatures.

It starts as a knowledge layer for Claude Code. As you use it, Hive learns your stack preferences, catches architecture drift before it becomes tech debt, and orchestrates entire builds from your proven patterns — plan a build, execute steps, review checkpoints, and resume across sessions.

## Quick Start

```bash
git clone https://github.com/twofoldtech-dakota/hive.git
cd hive
npm install
npm run build
```

Add Hive to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "hive": {
      "command": "node",
      "args": ["/path/to/hive/dist/server/index.js"]
    }
  }
}
```

Restart Claude Desktop. Hive is ready.

## What can you do with it?

| Category | What it does | Try saying... |
|----------|-------------|---------------|
| **Discovery** | Capture ideas, score feasibility, evaluate before committing to code | "Capture my idea for a recipe sharing app" |
| **Project Architecture** | Track architecture docs, log decisions, manage projects | "Show me the architecture for my-project" |
| **Knowledge Registry** | Store patterns, dependency surfaces, anti-patterns | "Register this auth pattern for reuse" |
| **Build Acceleration** | Assemble features from patterns, snapshot and search knowledge | "Add authentication to my project using known patterns" |
| **Intelligence** | Detect drift, suggest patterns, surface past decisions, score confidence | "What should I know before building another API?" |
| **Cross-Project** | Compare projects, trace pattern lineage, build decision graphs | "Compare project-a and project-b" |
| **Build Agent** | Plan builds, execute steps, review checkpoints, resume across sessions | "Plan a build for this project" |
| **Project Management** | Backlog tracking, project archiving | "Add a bug to the backlog for my-project" |
| **Business Operations** | Revenue tracking, invoicing, expense tracking, financial reports | "Generate an invoice for client X" |

46 tools across 10 categories. See the [full tool reference](docs/tools.md) for every tool.

## Interactive Views

Hive includes 5 interactive UI views that render automatically in Claude Desktop:

| View | What it shows |
|------|--------------|
| **Idea Scorecard** | Feasibility, scope, and competitive analysis for a captured idea |
| **Idea Kanban** | All ideas organized by status |
| **Architecture Viewer** | Visual architecture doc with components, stack, and decisions |
| **Pattern Gallery** | Browsable gallery of registered code patterns with tags and code |
| **Search Results** | Ranked search results across all Hive knowledge |

## How Hive stores knowledge

All data lives in `~/.hive/hive.db` — a single SQLite database:

| Table | What it stores |
|-------|---------------|
| `ideas` / `idea_evaluations` | Captured ideas with feasibility evaluations |
| `projects` | Per-project architecture docs and metadata |
| `decisions` | Architectural decisions linked to projects |
| `patterns` | Verified reusable code patterns with tags and files |
| `dependencies` | Cached API surfaces for libraries |
| `antipatterns` | Things that didn't work and what to do instead |
| `build_plans` / `build_tasks` | Build orchestration state |
| `backlog_items` | Per-project backlog (bugs, improvements, ideas) |
| `clients` / `invoices` | Client billing and invoicing |
| `revenue_entries` / `expenses` | Financial tracking |

SQLite was chosen for reliability and zero-config setup. The entire knowledge base is a single file you can back up, move, or inspect with any SQLite client.

## Documentation

- **[Tool Reference](docs/tools.md)** — All 46 tools organized by category
- **[Architecture Guide](docs/architecture.md)** — How Hive is built, how to extend it

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
