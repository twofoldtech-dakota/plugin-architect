/**
 * Hive — StreamableHTTP transport
 *
 * Runs the MCP server over HTTP using Express so it can be used
 * with Claude.ai custom connectors and remote MCP clients.
 */

import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  lastActivity: number;
}

/**
 * Start the Hive MCP server in HTTP mode.
 *
 * @param createServer Factory that returns a fully-configured McpServer
 */
export async function startHttpServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.HIVE_PORT ?? "3100", 10);

  const app = express();
  app.use(cors());
  app.use(express.json());

  const sessions = new Map<string, SessionEntry>();

  // Handle MCP requests (POST = JSON-RPC, GET = SSE stream, DELETE = close session)
  app.all("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // For GET and DELETE, an existing session is required
    if (req.method === "GET" || req.method === "DELETE") {
      if (!sessionId || !sessions.has(sessionId)) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      const entry = sessions.get(sessionId)!;
      entry.lastActivity = Date.now();
      await entry.transport.handleRequest(req, res);
      if (req.method === "DELETE") {
        sessions.delete(sessionId);
      }
      return;
    }

    // POST — either resume existing session or start new one
    if (req.method === "POST") {
      if (sessionId && sessions.has(sessionId)) {
        const entry = sessions.get(sessionId)!;
        entry.lastActivity = Date.now();
        await entry.transport.handleRequest(req, res, req.body);
        return;
      }

      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server, lastActivity: Date.now() });
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  });

  // Health check
  app.get("/health", (_req, res) => {
    let oldestAge = 0;
    const now = Date.now();
    for (const entry of sessions.values()) {
      const age = now - entry.lastActivity;
      if (age > oldestAge) oldestAge = age;
    }
    res.json({ status: "ok", sessions: sessions.size, max_idle_ms: oldestAge });
  });

  app.listen(port, () => {
    console.error(`Hive MCP server listening on http://localhost:${port}/mcp`);

    // Clean up idle sessions every 5 minutes
    const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of sessions) {
        if (now - entry.lastActivity > SESSION_TTL) {
          sessions.delete(id);
          entry.transport.close?.();
        }
      }
    }, 5 * 60 * 1000);
  });
}
