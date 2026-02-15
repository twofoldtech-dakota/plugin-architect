<div align="center">

# Plugin Architect

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-6C5CE7?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=)](https://claude.ai)
[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)](https://github.com/twofoldtech-dakota/plugin-architect)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

**Design and build Claude Code plugins — from idea to working code in a single conversation.**

Plugin Architect turns Claude into an expert architect for the entire extension ecosystem.<br/>
Describe what you want to build, and it handles component selection, architecture design,<br/>
and full implementation — no TODOs, no placeholders.

[Install](#quick-start) · [What You Can Build](#what-you-can-build) · [How It Works](#how-it-works) · [Examples](#examples)

</div>

---

## Quick Start

**Install from the marketplace:**

```
/plugin marketplace add twofoldtech-dakota/plugin-architect
/plugin install plugin-architect@twofoldtech-dakota-plugin-architect
```

**Then run:**

```
/plugin-architect
```

That's it. Describe what you want to build and Claude handles the rest.

## What You Can Build

Plugin Architect covers all 6 Claude Code extension points:

| Component | What it does | Example use case |
|-----------|-------------|------------------|
| **Skill** | Teach Claude domain expertise or create slash commands | `/review` command with your team's standards |
| **MCP Server** | Connect Claude to external APIs and databases | Query Jira, Slack, or your internal tools |
| **Hook** | Enforce rules on every edit, commit, or tool call | Block hardcoded secrets, auto-format on save |
| **Agent** | Define specialized autonomous workers | Security-focused code reviewer |
| **LSP Server** | Give Claude real-time code intelligence | Custom language diagnostics |
| **Plugin** | Bundle everything above for distribution | Team toolkit shared via marketplace |

## How It Works

1. **Discover** — Tell Claude what you want to build. It asks the right questions to understand your domain, audience, and constraints.
2. **Classify** — Claude determines which components you need based on a built-in decision matrix.
3. **Design** — You get a complete architecture: file structure, component map, and integration plan.
4. **Build** — Claude writes every file. Production-ready code with proper error handling, auth patterns, and deployment config.

## Examples

**"I want a slash command for deploying"**
→ Skill with pre-deploy checks, environment targeting, and confirmation gates

**"I want Claude to talk to our project management API"**
→ MCP server with typed tools, auth configuration, and error handling

**"I want to block secrets from being committed"**
→ PreToolUse hook with pattern matching on Edit/Write operations

**"I want all of that for my team"**
→ Full plugin bundle with marketplace distribution

## What's Included

| File | Purpose |
|------|---------|
| `skills/plugin-architect/SKILL.md` | Core instructions, ecosystem reference, and architecture decision guide |
| `skills/plugin-architect/examples.md` | 5 complete plugin examples — from simple skills to full-featured plugins |
| `skills/plugin-architect/integrations.md` | Integration patterns for databases, APIs, auth, deployment, and observability |

## Local Development

```bash
git clone https://github.com/twofoldtech-dakota/plugin-architect.git
claude --plugin-dir ./plugin-architect
```

## License

MIT
