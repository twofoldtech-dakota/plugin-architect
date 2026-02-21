# Plugin Examples Reference

## Example 1: Simple Skill-Only Plugin

A plugin that teaches Claude your team's code review standards.

### Structure

```
code-review-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── review/
│       └── SKILL.md
└── README.md
```

### plugin.json

```json
{
  "name": "code-review",
  "description": "Team code review standards and checklists",
  "version": "1.0.0"
}
```

### skills/review/SKILL.md

```yaml
---
name: review
description: Review code changes against team standards. Use when asked to review a PR, diff, or code changes.
user-invocable: true
allowed-tools: Read, Grep, Glob
argument-hint: "[file-or-pr]"
---

# Code Review

Review the specified code against these standards:

## Checklist
1. No hardcoded secrets or credentials
2. Error handling on all async operations
3. Input validation at system boundaries
4. Tests cover the happy path and at least one error case
5. No console.log left in production code

## Response Format
For each finding, state:
- **File:Line** — location
- **Severity** — Critical / Warning / Nit
- **Issue** — what's wrong
- **Fix** — how to fix it
```

---

## Example 2: MCP Server Plugin

A plugin that provides tools for interacting with a project management API.

### Structure

```
pm-tools-plugin/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── mcp-server/
│   ├── src/
│   │   ├── index.ts
│   │   └── tools.ts
│   ├── package.json
│   └── tsconfig.json
├── skills/
│   └── pm-workflow/
│       └── SKILL.md
└── README.md
```

### .mcp.json

```json
{
  "mcpServers": {
    "pm-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-server/build/index.js"],
      "env": {
        "PM_API_KEY": "${PM_API_KEY}",
        "PM_BASE_URL": "${PM_BASE_URL:-https://api.example.com}"
      }
    }
  }
}
```

### mcp-server/src/index.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "pm-tools",
  version: "1.0.0",
  capabilities: { tools: { listChanged: true } },
});

const BASE_URL = process.env.PM_BASE_URL || "https://api.example.com";
const API_KEY = process.env.PM_API_KEY;

async function apiCall(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

server.registerTool("list-tasks", {
  description: "List tasks for a project. Returns task ID, title, status, and assignee. Use when user asks about project tasks or work items.",
  inputSchema: {
    project_id: z.string().describe("Project identifier"),
    status: z.enum(["open", "in_progress", "done", "all"]).optional().describe("Filter by status"),
  },
}, async ({ project_id, status }) => {
  const query = status && status !== "all" ? `?status=${status}` : "";
  const data = await apiCall(`/projects/${project_id}/tasks${query}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.registerTool("create-task", {
  description: "Create a new task in a project. Returns the created task with its ID. Use when user wants to add a task or work item.",
  inputSchema: {
    project_id: z.string().describe("Project identifier"),
    title: z.string().describe("Task title"),
    description: z.string().optional().describe("Task description"),
    assignee: z.string().optional().describe("Assignee username"),
  },
}, async ({ project_id, title, description, assignee }) => {
  const res = await fetch(`${BASE_URL}/projects/${project_id}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, description, assignee }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PM Tools MCP server running");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
```

---

## Example 3: Hook-Based Plugin

A plugin that enforces coding standards automatically.

### Structure

```
standards-enforcer/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── check-secrets.sh
│       └── auto-format.sh
└── README.md
```

### hooks/hooks.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/scripts/check-secrets.sh",
            "timeout": 10,
            "statusMessage": "Checking for secrets..."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/scripts/auto-format.sh",
            "timeout": 30,
            "statusMessage": "Auto-formatting...",
            "async": true
          }
        ]
      }
    ]
  }
}
```

### hooks/scripts/check-secrets.sh

```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty')

# Check for common secret patterns
if echo "$CONTENT" | grep -qiE '(api[_-]?key|secret|password|token)\s*[=:]\s*["\x27][A-Za-z0-9+/=_-]{16,}'; then
  echo "BLOCKED: Detected hardcoded secret in $FILE" >&2
  exit 2
fi

exit 0
```

---

## Example 4: Full-Featured Plugin

Combines skills, MCP, hooks, and agents.

### Structure

```
full-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── design/
│   │   └── SKILL.md           # Architecture design skill
│   └── deploy/
│       └── SKILL.md           # Deployment workflow skill
├── agents/
│   └── reviewer.md            # Code review subagent
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       └── pre-deploy.sh
├── .mcp.json                  # Connects to internal APIs
├── .lsp.json                  # TypeScript language server
└── README.md
```

### agents/reviewer.md

```yaml
---
name: reviewer
description: Autonomous code review agent that checks for security, performance, and style issues
model: claude-sonnet-4-5-20250929
allowed-tools: Read, Grep, Glob
---

You are a code review agent. When spawned:

1. Read all changed files (provided in your task context)
2. Check each file for:
   - Security issues (injection, XSS, hardcoded secrets)
   - Performance issues (N+1 queries, missing indexes, blocking calls)
   - Style violations (naming, structure, documentation)
3. Return a structured review with findings by severity
```

### skills/deploy/SKILL.md

```yaml
---
name: deploy
description: Guided deployment workflow with safety checks
disable-model-invocation: true
user-invocable: true
argument-hint: "[environment]"
allowed-tools: Bash(git *), Bash(npm *), Bash(docker *)
---

# Deploy to $ARGUMENTS

## Pre-deploy checks
(Use context injection to populate these at load time)
1. Verify all tests pass
2. Check current branch
3. Check for uncommitted changes

## Steps
1. Run the full test suite
2. Build the project
3. If deploying to production, ask for explicit confirmation
4. Execute the deployment
5. Verify health checks pass
6. Report the deployment result
```

---

## Example 5: Analytics MCP Server Plugin

### Structure

```
analytics-plugin/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .mcp.json
├── mcp-server/
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

### .claude-plugin/marketplace.json

```json
{
  "name": "your-org-your-marketplace",
  "owner": {
    "name": "your-org"
  },
  "plugins": [
    {
      "name": "analytics",
      "description": "Analytics tools for querying metrics, dashboards, and reports",
      "source": {
        "source": "github",
        "repo": "your-org/analytics-plugin"
      }
    }
  ]
}
```

### mcp-server/src/index.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "analytics",
  version: "1.0.0",
  capabilities: { tools: { listChanged: true } },
});

const BASE_URL = process.env.ANALYTICS_URL || "https://analytics.example.com/api";
const API_KEY = process.env.ANALYTICS_API_KEY;

async function apiCall(path: string, params?: Record<string, string>): Promise<string> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.text();
}

server.registerTool("query-metrics", {
  description: "Query a metric over a time range. Returns time series data points. Use when the user asks about metrics, stats, or trends.",
  inputSchema: {
    metric: z.string().describe("Metric name (e.g. 'page_views', 'signups', 'revenue')"),
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().describe("End date in YYYY-MM-DD format"),
    granularity: z.enum(["hour", "day", "week", "month"]).optional().describe("Time granularity"),
  },
}, async ({ metric, start_date, end_date, granularity }) => {
  const data = await apiCall(`/metrics/${metric}`, {
    start: start_date,
    end: end_date,
    granularity: granularity ?? "day",
  });
  return { content: [{ type: "text", text: data }] };
});

server.registerTool("list-dashboards", {
  description: "List all available analytics dashboards. Returns dashboard names and IDs. Use when the user asks what dashboards or reports are available.",
  inputSchema: {},
}, async () => {
  const data = await apiCall("/dashboards");
  return { content: [{ type: "text", text: data }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Analytics MCP server running");
```

### Distribution & Installation

```bash
# Publish to a marketplace repo, then users install with:
/plugin marketplace add your-org/your-marketplace
/plugin install analytics@your-org-your-marketplace

# Local development:
claude --plugin-dir ./analytics-plugin
```
