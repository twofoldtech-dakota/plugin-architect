# Integration Patterns Reference

## Database Integrations (MCP Server)

| Database | Package | Best for |
|----------|---------|----------|
| SQLite | `better-sqlite3` | Local, zero-config, single-user |
| PostgreSQL | `pg` | Production relational |
| Redis | `ioredis` | Cache, queues, pub/sub |
| MongoDB | `mongodb` | Document storage |
| Turso/libSQL | `@libsql/client` | Edge SQLite with sync |

### SQLite Pattern (TypeScript)

```typescript
import Database from "better-sqlite3";

export function createDb(dbPath: string) {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
```

---

## API Client Pattern

```typescript
interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class ApiClient {
  constructor(private config: ApiConfig) {}

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout ?? 30_000),
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${await response.text()}`);
    }
    return response.json() as T;
  }
}
```

---

## Auth Patterns

### API Key (simplest)

Via environment variable in `.mcp.json`:
```json
{ "env": { "API_KEY": "${MY_SERVICE_API_KEY}" } }
```

Read in server:
```typescript
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API_KEY required");
```

### OAuth 2.0 (user-facing integrations)

For HTTP MCP servers, Claude Code handles OAuth automatically:
```bash
claude mcp add --transport http my-service https://mcp.service.com/api
# Then: /mcp → opens browser for OAuth login
```

For custom OAuth in stdio servers:
```typescript
import { OAuth2Client } from "google-auth-library";
// Store tokens in ~/.config/my-server/tokens.json
```

### JWT (service-to-service)

```typescript
import jwt from "jsonwebtoken";

function createToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "1h" });
}
```

---

## Common External Service Integrations

### GitHub (Octokit)

```typescript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

server.registerTool("list-issues", {
  description: "List open issues for a repository",
  inputSchema: {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
  },
}, async ({ owner, repo }) => {
  const { data } = await octokit.issues.listForRepo({ owner, repo, state: "open" });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});
```

### Slack (Web API)

```typescript
import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_TOKEN);

server.registerTool("send-message", {
  description: "Send a message to a Slack channel",
  inputSchema: {
    channel: z.string().describe("Channel ID"),
    text: z.string().describe("Message text"),
  },
}, async ({ channel, text }) => {
  await slack.chat.postMessage({ channel, text });
  return { content: [{ type: "text", text: "Message sent" }] };
});
```

### Stripe

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_KEY!);

server.registerTool("list-invoices", {
  description: "List recent invoices for a customer",
  inputSchema: {
    customer_id: z.string().describe("Stripe customer ID"),
  },
}, async ({ customer_id }) => {
  const invoices = await stripe.invoices.list({ customer: customer_id, limit: 10 });
  return { content: [{ type: "text", text: JSON.stringify(invoices.data, null, 2) }] };
});
```

---

## Hook Script Patterns

### Pre-commit Validation Hook

```bash
#!/bin/bash
# hooks/validate-edit.sh
# Receives JSON on stdin with tool_input

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Block edits to protected files
if [[ "$FILE" == *".env"* ]] || [[ "$FILE" == *"credentials"* ]]; then
  echo '{"decision":"deny","reason":"Cannot edit sensitive files"}' >&2
  exit 2
fi

exit 0
```

### Auto-format After Edit Hook

```bash
#!/bin/bash
# hooks/auto-format.sh
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx) npx prettier --write "$FILE" 2>/dev/null ;;
  *.rs) rustfmt "$FILE" 2>/dev/null ;;
esac

exit 0
```

### Test Runner After Edit Hook

```json
{
  "PostToolUse": [{
    "matcher": "Edit|Write",
    "hooks": [{
      "type": "command",
      "command": "npm test -- --bail",
      "async": true,
      "timeout": 120,
      "statusMessage": "Running tests..."
    }]
  }]
}
```

---

## Deployment Patterns

### npx Distribution (simplest for stdio)

```json
{
  "name": "@org/my-mcp-server",
  "bin": { "my-mcp-server": "./build/index.js" },
  "files": ["build/"],
  "scripts": { "prepublishOnly": "npm run build" }
}
```

Users install with: `claude mcp add my-server -- npx -y @org/my-mcp-server`

### Docker (HTTP servers)

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY build/ ./build/
EXPOSE 3000
CMD ["node", "build/index.js"]
```

### Cloudflare Workers (edge HTTP)

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    // Handle MCP HTTP transport
  },
};
```

---

## Observability

### Structured Logging (stdio-safe)

```typescript
function log(level: string, message: string, data?: object) {
  const entry = { timestamp: new Date().toISOString(), level, message, ...data };
  console.error(JSON.stringify(entry));  // stderr only for stdio!
}
```

### Error Handling in Tools

```typescript
server.registerTool("safe-tool", {
  description: "Tool with proper error handling",
  inputSchema: { query: z.string() },
}, async ({ query }) => {
  try {
    const result = await doWork(query);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});
```
