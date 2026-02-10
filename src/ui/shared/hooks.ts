/**
 * Hive UI — shared React hooks
 *
 * useHiveApp<T>() wraps @modelcontextprotocol/ext-apps/react
 * to provide typed data, loading state, and tool-calling helpers.
 */

import { useState, useCallback, useRef } from "react";
import {
  useApp,
  useHostStyles,
  useDocumentTheme,
  type App,
} from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export { useDocumentTheme };

export interface HiveAppState<T> {
  /** Parsed tool result data */
  data: T | null;
  /** True while waiting for initial tool result */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** The underlying App instance */
  app: App | null;
  /** Call an MCP server tool */
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult | undefined>;
  /** Send a user message to chat */
  sendMessage: (text: string) => Promise<void>;
}

/** Declare dev fixture on window for browser testing */
declare global {
  interface Window {
    __HIVE_DATA__?: unknown;
  }
}

/**
 * Parse the text content from a CallToolResult into typed data.
 */
function parseToolResult<T>(result: CallToolResult): T | null {
  const textBlock = result.content?.find(
    (c): c is { type: "text"; text: string } => c.type === "text",
  );
  if (!textBlock?.text) return null;
  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    return null;
  }
}

/**
 * Main hook for Hive views. Connects to the MCP Apps host,
 * applies theme, and parses tool result data into typed T.
 */
export function useHiveApp<T>(
  name: string,
  version = "0.1.0",
): HiveAppState<T> {
  const [data, setData] = useState<T | null>(() => {
    // Dev fallback: load fixture data from window
    if (typeof window !== "undefined" && window.__HIVE_DATA__) {
      return window.__HIVE_DATA__ as T;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!window.__HIVE_DATA__);
  const [error, setError] = useState<string | null>(null);
  const gotResult = useRef(false);

  const { app, isConnected, error: connError } = useApp({
    appInfo: { name, version },
    capabilities: {},
    onAppCreated: (appInstance) => {
      appInstance.ontoolinput = () => {
        if (!gotResult.current) setIsLoading(true);
      };

      appInstance.ontoolresult = (result) => {
        gotResult.current = true;
        const parsed = parseToolResult<T>(result);
        if (parsed !== null) {
          setData(parsed);
          setError(null);
        } else if (result.isError) {
          const errText = result.content?.find(
            (c): c is { type: "text"; text: string } => c.type === "text",
          );
          setError(errText?.text ?? "Tool returned an error");
        }
        setIsLoading(false);
      };

      appInstance.ontoolcancelled = (params) => {
        setIsLoading(false);
        setError(params.reason ?? "Tool call cancelled");
      };
    },
  });

  // Apply host theme + styles
  useHostStyles(app, app?.getHostContext());

  // Set connection error
  if (connError && !error) {
    setError(connError.message);
  }

  const callTool = useCallback(
    async (toolName: string, args?: Record<string, unknown>) => {
      if (!app) return undefined;
      return app.callServerTool({ name: toolName, arguments: args });
    },
    [app],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!app) return;
      await app.sendMessage({
        role: "user",
        content: [{ type: "text", text }],
      });
    },
    [app],
  );

  return { data, isLoading, error, app, callTool, sendMessage };
}
