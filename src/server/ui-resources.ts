/**
 * Hive — UI resource registration
 *
 * Registers bundled view HTML files as MCP App resources
 * so tools can reference them via ui://hive/{view-name}.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

const VIEWS = [
  "idea-scorecard",
  "idea-kanban",
  "architecture-viewer",
  "pattern-gallery",
  "search-results",
] as const;

export type ViewName = (typeof VIEWS)[number];

function distDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "ui", "views");
}

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
