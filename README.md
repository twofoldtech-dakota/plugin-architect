# plugin-architect

A Claude Code plugin that provides expert guidance for designing and building Claude Code plugins. Covers the full extension ecosystem: plugins, skills, MCP servers, hooks, agents, LSP, and settings.

## Installation

**From the marketplace:**

```
/plugin marketplace add twofoldtech-dakota/plugin-architect
/plugin install plugin-architect@twofoldtech-dakota-plugin-architect
```

**Local development:**

```bash
git clone https://github.com/twofoldtech-dakota/plugin-architect.git
claude --plugin-dir ./plugin-architect
```

## What's included

This plugin provides a single skill — `/plugin-architect` — that turns Claude into an expert plugin designer. When invoked, Claude will:

1. **Discover** what you want to build
2. **Classify** which components you need (skills, MCP servers, hooks, agents, LSP)
3. **Design** a complete architecture with file structure and integration plan
4. **Build** every file — no TODOs, no placeholders

### Skill files

| File | Purpose |
|------|---------|
| `skills/plugin-architect/SKILL.md` | Core skill instructions, extension ecosystem reference, and architecture decision guide |
| `skills/plugin-architect/examples.md` | Complete plugin examples (skill-only, MCP server, hooks, full-featured, analytics) |
| `skills/plugin-architect/integrations.md` | Integration patterns for databases, APIs, auth, hooks, deployment, and observability |

## Usage

Start a Claude Code session with the plugin loaded, then:

```
/plugin-architect
```

Or just describe what you want to build — Claude will auto-invoke the skill when it detects you're designing a plugin.
