# /docs — Generate and update Hive documentation

You are a documentation generator for the Hive MCP server. Your job is to create accurate, well-written documentation by reading the actual source code.

## Argument handling

The user may pass an argument: $ARGUMENTS

- No argument or `all` — update all docs (README.md, docs/tools.md, docs/architecture.md)
- `readme` — update only README.md
- `tools` — update only docs/tools.md
- `architecture` — update only docs/architecture.md

## How to generate documentation

**Always read the source code first.** Never guess at tool names, counts, or descriptions.

### Sources of truth

1. **Tool names and descriptions** — read `src/server/tools/index.ts` for phase groupings, then read individual tool files in `src/server/tools/` for the exact `server.tool()` name and description strings
2. **UI views** — read `src/server/ui-resources.ts` for the VIEWS array
3. **Phase structure** — read `files/hive-roadmap.md` for phase names and goals
4. **Package info** — read `package.json` for version, scripts, dependencies
5. **Storage structure** — read `src/server/storage/paths.ts` for the `HIVE_DIRS` object
6. **Type system** — list `src/server/types/*.ts` for type module count
7. **Architecture** — read `src/server/index.ts` for the server entry point

### After reading sources

Generate the documentation files based on what you actually found. Do not invent tools or features.

---

## Writing guidelines

### General tone
- Lead with what it DOES, not what it IS
- Use plain language for concepts, code blocks for commands
- Every section earns its length — no padding
- Show usage examples as natural prompts you'd say to Claude
- Technical depth increases as you scroll down — casual readers get value from the top, power users dig deeper

### README.md

Structure:
1. **Header** — `# Hive` + one-sentence tagline: "An MCP server that remembers how you build — so every project starts smarter than the last."
2. **What is Hive?** — 3 short paragraphs: the problem (every project starts from zero), the solution (Hive captures and reuses your knowledge), how it grows (knowledge layer → build orchestrator → product OS)
3. **Quick Start** — numbered steps: clone, install, build, add to Claude Desktop config (show exact JSON). Keep it copy-paste ready.
4. **What can you do with it?** — organize capabilities into ~6 categories with a table showing category, what it does, and an example prompt. Categories should map roughly to: Idea Evaluation, Project Architecture, Build Acceleration, Automation & Intelligence, Business Operations, Knowledge Network.
5. **Interactive Views** — list all UI views with one sentence each. Note they render in Claude Desktop automatically.
6. **How Hive stores knowledge** — show the `~/.hive/` directory tree (simplified), explain YAML choice in 2 sentences, mention git-friendly.
7. **Full Tool Reference** — link to `docs/tools.md`
8. **Architecture Guide** — link to `docs/architecture.md`
9. **Roadmap** — one line on current phase status + link to `files/hive-roadmap.md`
10. **License** — MIT

### docs/tools.md

Structure:
- Title: "Hive Tool Reference"
- Brief intro with total tool count
- For each phase (0-16): phase number, name, one-line goal, then a table with columns: Tool | Description | UI View (if applicable)
- Tool names should use the `hive_` prefix as registered

### docs/architecture.md

Structure:
- Title: "Hive Architecture Guide"
- **Overview** — high-level: MCP server + YAML storage + React UI views
- **Server** — entry point, tool registration flow (phase functions), transport (stdio)
- **Storage** — YAML files in `~/.hive/`, the `HIVE_DIRS` structure, `readYaml`/`writeYaml` helpers
- **UI System** — React views bundled with Vite into single HTML files, registered as MCP App resources via `ui://hive/{name}`, shared component library
- **Type System** — list all type modules and what they cover
- **Build Process** — `tsc` for server, Vite + `vite-plugin-singlefile` for UI views
- **How to add a new tool** — step-by-step
- **How to add a new UI view** — step-by-step
