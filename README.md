# Hive

An MCP server that remembers how you build — so every project starts smarter than the last.

## What is Hive?

Every new project starts from zero. You've solved auth, set up databases, configured deploys a dozen times. That knowledge lives scattered across old repos you'll never search through again. Meanwhile, your AI assistant hallucinates API signatures and suggests patterns you abandoned two projects ago.

Hive is an MCP server that captures your architecture decisions, code patterns, and project knowledge in one queryable place. Register a pattern once, and it's available for every future project. Log a decision, and Hive surfaces it the next time you face the same choice. Cache a dependency's real API surface, and Claude stops guessing at function signatures.

It starts as a knowledge layer for Claude Code. As you use it, Hive learns your stack preferences, catches architecture drift before it becomes tech debt, and eventually scaffolds entire projects from your proven patterns. The end state: describe what you want to build, and Hive handles everything from planning to deploy to monitoring.

## Quick Start

```bash
git clone https://github.com/dakotasmith/hive.git
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
| **Idea Evaluation** | Capture ideas, score feasibility, evaluate before committing to code | "Capture my idea for a recipe sharing app" |
| **Project Architecture** | Track architecture docs, log decisions, register API contracts | "Show me the architecture for my-project" |
| **Knowledge Registry** | Store patterns, dependency surfaces, anti-patterns, and stack presets | "Register this auth pattern for reuse" |
| **Build Acceleration** | Scaffold projects from presets, assemble features from patterns | "Scaffold a new project using my next-drizzle stack" |
| **Intelligence** | Detect drift, suggest patterns, surface past decisions, estimate effort | "What should I know before building another API?" |
| **Autonomous Building** | Plan builds, execute steps, review checkpoints, resume across sessions | "Plan a build for this project" |
| **Fleet Management** | Monitor all projects, scan deps fleet-wide, track costs and health | "What should I work on next?" |
| **Business Operations** | Revenue tracking, invoicing, contracts, compliance, expenses | "Generate an invoice for client X" |
| **Content & Marketing** | Launch assets, changelogs, campaigns, content from your codebase | "Generate launch assets for my-project" |
| **Knowledge Marketplace** | Package and sell your patterns and stack presets | "Package my auth pattern for the marketplace" |

93 tools across 17 phases. See the [full tool reference](docs/tools.md) for every tool.

## Interactive Views

Hive includes 8 interactive UI views that render automatically in Claude Desktop when you use the relevant tools:

| View | What it shows |
|------|--------------|
| **Idea Scorecard** | Feasibility, scope, and competitive analysis for a captured idea |
| **Idea Kanban** | All ideas organized by status — drag to re-prioritize |
| **Architecture Viewer** | Visual architecture doc with components, stack, and decisions |
| **Pattern Gallery** | Browsable gallery of registered code patterns with tags and code |
| **Progress Dashboard** | Build progress bars comparing spec vs. actual implementation |
| **Feature Evaluator** | Effort/impact analysis with Build, Defer, Cut, or Simplify actions |
| **Scaffold Preview** | Preview of project scaffolding before applying it |
| **Search Results** | Ranked search results across all Hive knowledge |

## How Hive stores knowledge

All data lives in `~/.hive/` as flat YAML files:

```
~/.hive/
  config.yaml
  ideas/                    # Captured ideas with evaluations
  projects/{slug}/          # Per-project architecture, decisions, APIs, build plans
  knowledge/
    patterns/               # Verified reusable code patterns
    dependencies/           # Cached API surfaces for libraries
    stacks/                 # Full stack presets (e.g., "next-drizzle-sqlite")
    antipatterns/           # Things that didn't work
  fleet/                    # Fleet-wide project status and health
  revenue/                  # Revenue tracking and experiments
  business/                 # Clients, invoices, contracts, expenses
  marketing/                # Content and campaign analytics
  marketplace/              # Packaged patterns and stacks for sale
  mesh/                     # Peer-to-peer knowledge sharing
  retrospectives/           # Build retrospective analyses
  meta/                     # Self-audit telemetry and evolution proposals
  templates/                # Scaffolding templates
```

YAML was chosen over JSON for human readability and git-friendly diffs. No database — the entire knowledge base is a directory you can version, back up, or inspect with any text editor.

## Documentation

- **[Tool Reference](docs/tools.md)** — All 93 tools organized by phase
- **[Architecture Guide](docs/architecture.md)** — How Hive is built, how to extend it
- **[Roadmap](files/hive-roadmap.md)** — Full 17-phase roadmap from knowledge layer to autonomous builder OS

## License

MIT
