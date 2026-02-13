# Contributing to Hive

Thanks for your interest in contributing to Hive! Whether it's a bug report, feature idea, or code contribution, your input helps make this project better.

## Development setup

```bash
git clone https://github.com/twofoldtech-dakota/hive.git
cd hive
npm install
npm run build
```

### Scripts

| Script | What it does |
|--------|-------------|
| `npm run build` | Build server (TypeScript) + UI views (Vite) |
| `npm run build:server` | Build server only |
| `npm run build:ui` | Build UI views only |
| `npm run dev` | Watch mode for TypeScript server |
| `npm start` | Run the MCP server (stdio transport) |
| `npm run start:http` | Run the MCP server (HTTP transport) |

### Testing your changes

After making changes, rebuild and test against Claude Desktop:

```bash
npm run build
```

Then restart Claude Desktop to pick up your changes.

## Project structure

```
src/
  server/
    index.ts              # Server entry point
    tools/                # One file per MCP tool (46 tools)
    types/                # TypeScript type definitions
    storage/
      db.ts               # SQLite database layer
      repos/              # Data access repositories
      paths.ts            # File system paths
    ui-resources.ts       # Interactive UI view registration
  ui/                     # React views (Vite + Tailwind)
  build/                  # UI build scripts
```

## How to contribute

### Bug reports

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (Node version, OS, Claude Desktop version)

### Feature requests

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### Pull requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure `npm run build` succeeds
4. Open a PR with a clear description of what changed and why

## Code style

- TypeScript with strict mode enabled
- Match the existing patterns — each tool is a single file exporting a `register*` function
- No linter is configured yet; match the style of surrounding code

## Questions?

Open a [GitHub issue](https://github.com/twofoldtech-dakota/hive/issues) — there's no wrong question.
