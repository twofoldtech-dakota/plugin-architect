/**
 * Hive — UI resource registration
 *
 * Registers bundled view HTML files as MCP App resources
 * so tools can reference them via ui://hive/{view-name}.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

/** View name → resource URI */
const VIEWS = [
  "idea-scorecard",
  "idea-kanban",
  "architecture-viewer",
  "pattern-gallery",
  "progress-dashboard",
  "feature-evaluator",
  "scaffold-preview",
  "search-results",
] as const;

export type ViewName = (typeof VIEWS)[number];

/** Resolve the dist directory relative to this compiled file. */
function distDir(): string {
  // In compiled form: dist/server/ui-resources.js → dist/ui/views
  return join(import.meta.dirname, "..", "ui", "views");
}

/**
 * Register all bundled view HTML files as MCP App resources.
 * Views that haven't been bundled yet are silently skipped.
 */
export function registerUiResources(server: McpServer): void {
  const base = distDir();

  for (const name of VIEWS) {
    const htmlPath = join(base, name, "index.html");
    if (!existsSync(htmlPath)) continue;

    const uri = `ui://hive/${name}`;

    registerAppResource(
      server,
      `Hive ${name}`,
      uri,
      { description: `Interactive UI for ${name}` },
      async () => ({
        contents: [
          {
            uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: readFileSync(htmlPath, "utf-8"),
          },
        ],
      }),
    );
  }
}
