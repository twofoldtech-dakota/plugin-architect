/**
 * Hive — host context adapter
 *
 * Thin wrapper around @modelcontextprotocol/ext-apps App class.
 * Handles connection, applies host theme, and provides typed helpers
 * for tool input/output and calling back to MCP server tools.
 */

import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface HiveAppCallbacks {
  /** Called when the host sends complete tool arguments. */
  onToolInput?: (args: Record<string, unknown>) => void;
  /** Called when the host streams partial tool arguments. */
  onToolInputPartial?: (args: Record<string, unknown>) => void;
  /** Called when the host sends the tool execution result. */
  onToolResult?: (result: CallToolResult) => void;
  /** Called when the tool is cancelled by the host. */
  onToolCancelled?: (reason?: string) => void;
}

export interface HiveApp {
  /** The underlying ext-apps App instance. */
  raw: App;
  /** Call an MCP server tool (proxied through the host). */
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>;
  /** Send a user message to the chat. */
  sendMessage: (text: string) => Promise<void>;
}

/**
 * Initialize and connect a Hive view app.
 *
 * Call this once from each view's entry point. It:
 * 1. Creates an App instance and connects via PostMessageTransport
 * 2. Applies the host's theme (dark/light) and CSS variables
 * 3. Wires up the provided callbacks
 *
 * @returns A connected HiveApp with helpers for tool calls and messaging.
 */
export async function initApp(
  name: string,
  version: string,
  callbacks?: HiveAppCallbacks,
): Promise<HiveApp> {
  const app = new App({ name, version });

  // Wire up callbacks before connecting so we don't miss early events
  if (callbacks?.onToolInput) {
    app.ontoolinput = (params) => {
      callbacks.onToolInput!(params.arguments ?? {});
    };
  }

  if (callbacks?.onToolInputPartial) {
    app.ontoolinputpartial = (params) => {
      callbacks.onToolInputPartial!(params.arguments ?? {});
    };
  }

  if (callbacks?.onToolResult) {
    app.ontoolresult = (result) => {
      callbacks.onToolResult!(result);
    };
  }

  if (callbacks?.onToolCancelled) {
    app.ontoolcancelled = (params) => {
      callbacks.onToolCancelled!(params.reason);
    };
  }

  // Apply host theme when context changes
  app.onhostcontextchanged = (ctx) => applyHostContext(ctx);

  // Connect to parent window
  const transport = new PostMessageTransport(window.parent, window.parent);
  await app.connect(transport);

  // Apply initial host context
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx);

  return {
    raw: app,
    callTool: (toolName, args) =>
      app.callServerTool({ name: toolName, arguments: args }),
    sendMessage: async (text) => {
      await app.sendMessage({
        role: "user",
        content: [{ type: "text", text }],
      });
    },
  };
}

// ── Host context application ──────────────────────────────

interface HostContext {
  theme?: "light" | "dark";
  styles?: {
    variables?: Record<string, string | undefined>;
    css?: { fonts?: string };
  };
}

function applyHostContext(ctx: HostContext): void {
  const root = document.documentElement;

  // Apply theme class
  if (ctx.theme === "dark") {
    root.setAttribute("data-theme", "dark");
    root.classList.add("dark");
  } else if (ctx.theme === "light") {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }

  // Apply host CSS variables
  if (ctx.styles?.variables) {
    for (const [key, value] of Object.entries(ctx.styles.variables)) {
      if (value != null) {
        root.style.setProperty(key, value);
      }
    }
  }

  // Apply host fonts
  if (ctx.styles?.css?.fonts) {
    let fontStyle = document.getElementById("hive-host-fonts");
    if (!fontStyle) {
      fontStyle = document.createElement("style");
      fontStyle.id = "hive-host-fonts";
      document.head.append(fontStyle);
    }
    fontStyle.textContent = ctx.styles.css.fonts;
  }
}
