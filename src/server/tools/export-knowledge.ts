import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { PatternIndex } from "../types/pattern.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { EnhancedExportManifest, ExportRules, SanitizationReport } from "../types/marketplace.js";

const DEFAULT_EXPORT_RULES: ExportRules = {
  secrets_patterns: [
    "api[_-]?key",
    "secret",
    "password",
    "token",
    "credential",
    "private[_-]?key",
    "auth[_-]?token",
    "DATABASE_URL",
    "CONNECTION_STRING",
  ],
  exclude_patterns: [".env", "*.pem", "*.key", "credentials.*"],
  sanitize_fields: ["source", "learned_from", "used_in"],
  min_confidence: 2,
  min_usage: 0,
};

function sanitizeValue(value: unknown, rules: ExportRules): { result: unknown; secretsFound: number } {
  if (typeof value === "string") {
    let sanitized = value;
    let secretsFound = 0;
    for (const pattern of rules.secrets_patterns) {
      const regex = new RegExp(`(${pattern})\\s*[:=]\\s*["']?[^"'\\s]+["']?`, "gi");
      const matches = sanitized.match(regex);
      if (matches) {
        secretsFound += matches.length;
        sanitized = sanitized.replace(regex, `$1: "[REDACTED]"`);
      }
    }
    return { result: sanitized, secretsFound };
  }
  if (Array.isArray(value)) {
    let total = 0;
    const arr = value.map((v) => {
      const { result, secretsFound } = sanitizeValue(v, rules);
      total += secretsFound;
      return result;
    });
    return { result: arr, secretsFound: total };
  }
  if (value && typeof value === "object") {
    let total = 0;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (rules.sanitize_fields.includes(k)) {
        obj[k] = "[SANITIZED]";
        total++;
        continue;
      }
      const { result, secretsFound } = sanitizeValue(v, rules);
      total += secretsFound;
      obj[k] = result;
    }
    return { result: obj, secretsFound: total };
  }
  return { result: value, secretsFound: 0 };
}

function adjustForRecipient(data: Record<string, unknown>, recipient: string): Record<string, unknown> {
  if (recipient === "public") {
    // Most sanitized — strip all project references, used_in lists, learned_from
    const cleaned = { ...data };
    delete cleaned.decisions;
    if (Array.isArray(cleaned.patterns)) {
      cleaned.patterns = (cleaned.patterns as Record<string, unknown>[]).map((p) => {
        const { used_in: _, ...rest } = p as Record<string, unknown>;
        return rest;
      });
    }
    return cleaned;
  }
  if (recipient === "client") {
    // Moderate sanitization — keep decisions but strip internal notes
    const cleaned = { ...data };
    if (Array.isArray(cleaned.patterns)) {
      cleaned.patterns = (cleaned.patterns as Record<string, unknown>[]).map((p) => {
        const { notes: _, used_in: __, ...rest } = p as Record<string, unknown>;
        return rest;
      });
    }
    return cleaned;
  }
  // collaborator — minimal sanitization, keep most detail
  return data;
}

function toMarkdown(data: Record<string, unknown>): string {
  const lines: string[] = ["# Hive Knowledge Export", "", `Exported: ${new Date().toISOString()}`, ""];

  if (Array.isArray(data.patterns) && data.patterns.length > 0) {
    lines.push("## Patterns", "");
    for (const p of data.patterns as Record<string, unknown>[]) {
      lines.push(`### ${p.name ?? p.slug}`, "");
      if (p.description) lines.push(String(p.description), "");
      if (Array.isArray(p.tags) && p.tags.length > 0) {
        lines.push(`Tags: ${(p.tags as string[]).join(", ")}`, "");
      }
      if (Array.isArray(p.files)) {
        lines.push("**Files:**", "");
        for (const f of p.files as Record<string, unknown>[]) {
          lines.push(`\`${f.path}\``, "");
          if (f.content) {
            lines.push("```", String(f.content), "```", "");
          }
        }
      }
    }
  }

  if (Array.isArray(data.stacks) && data.stacks.length > 0) {
    lines.push("## Stacks", "");
    for (const s of data.stacks as Record<string, unknown>[]) {
      lines.push(`### ${s.name ?? "Stack"}`, "");
      if (s.description) lines.push(String(s.description), "");
    }
  }

  if (Array.isArray(data.dependencies) && data.dependencies.length > 0) {
    lines.push("## Dependencies", "");
    for (const d of data.dependencies as Record<string, unknown>[]) {
      lines.push(`### ${d.name} (v${d.version ?? "?"})`, "");
      if (d.surface && typeof d.surface === "object") {
        const surface = d.surface as Record<string, unknown>;
        if (Array.isArray(surface.gotchas) && surface.gotchas.length > 0) {
          lines.push("**Gotchas:**", "");
          for (const g of surface.gotchas) lines.push(`- ${g}`);
          lines.push("");
        }
      }
    }
  }

  if (Array.isArray(data.decisions) && data.decisions.length > 0) {
    lines.push("## Decisions", "");
    for (const group of data.decisions as Record<string, unknown>[]) {
      lines.push(`### Project: ${group.project}`, "");
      if (Array.isArray(group.decisions)) {
        for (const d of group.decisions as Record<string, unknown>[]) {
          lines.push(`- **${d.component}**: ${d.decision}`, `  Reasoning: ${d.reasoning}`, "");
        }
      }
    }
  }

  if (Array.isArray(data.antipatterns) && data.antipatterns.length > 0) {
    lines.push("## Anti-Patterns", "");
    for (const ap of data.antipatterns as Record<string, unknown>[]) {
      lines.push(`### ${ap.name}`, "");
      if (ap.description) lines.push(String(ap.description), "");
      if (ap.instead) lines.push(`**Instead:** ${ap.instead}`, "");
    }
  }

  return lines.join("\n");
}

export function registerExportKnowledge(server: McpServer): void {
  server.tool(
    "hive_export_knowledge",
    "Export Hive knowledge (patterns, dependencies, decisions, stacks, anti-patterns) to a single file. Supports sanitization, recipient-aware export, and multiple formats.",
    {
      scope: z
        .object({
          projects: z.array(z.string()).optional().describe("Project slugs to include decisions from"),
          patterns: z.array(z.string()).optional().describe("Pattern slugs to include (empty = all)"),
          stacks: z.array(z.string()).optional().describe("Stack slugs to include (empty = all)"),
          tags: z.array(z.string()).optional().describe("Filter patterns/stacks by tags"),
          all: z.boolean().optional().default(false).describe("Export everything"),
        })
        .optional()
        .default({ all: true })
        .describe("What to export"),
      format: z
        .enum(["hive_import", "markdown", "json", "zip"])
        .optional()
        .default("hive_import")
        .describe('Output format (default: "hive_import")'),
      sanitize: z
        .boolean()
        .optional()
        .default(false)
        .describe("Apply sanitization rules (strip secrets, exclude sensitive content)"),
      recipient: z
        .enum(["client", "collaborator", "public"])
        .optional()
        .describe("Adjust detail level based on recipient type"),
      output_path: z
        .string()
        .optional()
        .describe("Output file path (defaults to ~/.hive/exports/)"),
    },
    async ({ scope, format, sanitize, recipient, output_path }) => {
      const includeAll = scope.all;
      const bundle: Record<string, unknown> = {};
      const counts = { patterns: 0, stacks: 0, decisions: 0, dependencies: 0, antipatterns: 0 };
      const report: SanitizationReport = {
        secrets_removed: 0,
        files_excluded: [],
        files_modified: [],
        fields_sanitized: [],
      };

      // Load export rules if sanitizing
      let rules: ExportRules;
      if (sanitize) {
        try {
          rules = await readYaml<ExportRules>(join(HIVE_DIRS.marketplace, "export-rules.yaml"));
        } catch {
          rules = DEFAULT_EXPORT_RULES;
        }
      } else {
        rules = DEFAULT_EXPORT_RULES;
      }

      // Patterns
      if (includeAll || scope.patterns !== undefined) {
        try {
          const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
          const patterns: Record<string, unknown>[] = [];
          for (const entry of index.patterns) {
            // Filter by slug list if provided
            if (scope.patterns && scope.patterns.length > 0 && !scope.patterns.includes(entry.slug)) continue;
            // Filter by tags if provided
            if (scope.tags && scope.tags.length > 0 && !scope.tags.some((t) => entry.tags.includes(t))) continue;

            try {
              const pattern = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.patterns, `${entry.slug}.yaml`));
              patterns.push(pattern);
            } catch {
              continue;
            }
          }
          bundle.patterns = patterns;
          counts.patterns = patterns.length;
        } catch {
          bundle.patterns = [];
        }
      }

      // Dependencies
      if (includeAll) {
        try {
          const depDirs = await readdir(HIVE_DIRS.dependencies);
          const deps: Record<string, unknown>[] = [];
          for (const dir of depDirs) {
            try {
              const meta = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.dependencies, dir, "meta.yaml"));
              const surface = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.dependencies, dir, "surface.yaml"));
              deps.push({ ...meta, surface });
            } catch {
              continue;
            }
          }
          bundle.dependencies = deps;
          counts.dependencies = deps.length;
        } catch {
          bundle.dependencies = [];
        }
      }

      // Decisions (from specified or all projects)
      if (includeAll || scope.projects !== undefined) {
        try {
          const projectDirs = await readdir(HIVE_DIRS.projects);
          const allDecisions: Array<{ project: string; decisions: unknown[] }> = [];
          for (const dir of projectDirs) {
            // Filter by project list if provided
            if (scope.projects && scope.projects.length > 0 && !scope.projects.includes(dir)) continue;
            try {
              const log = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, dir, "decisions.yaml"));
              if (log.decisions.length > 0) {
                allDecisions.push({ project: dir, decisions: log.decisions });
                counts.decisions += log.decisions.length;
              }
            } catch {
              continue;
            }
          }
          bundle.decisions = allDecisions;
        } catch {
          bundle.decisions = [];
        }
      }

      // Stacks
      if (includeAll || scope.stacks !== undefined) {
        try {
          const stackFiles = await readdir(HIVE_DIRS.stacks);
          const stacks: Record<string, unknown>[] = [];
          for (const file of stackFiles.filter((f) => f.endsWith(".yaml"))) {
            const slug = file.replace(".yaml", "");
            if (scope.stacks && scope.stacks.length > 0 && !scope.stacks.includes(slug)) continue;

            try {
              const stack = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.stacks, file));
              // Filter by tags if provided
              if (scope.tags && scope.tags.length > 0) {
                const stackTags = Array.isArray(stack.tags) ? (stack.tags as string[]) : [];
                if (!scope.tags.some((t) => stackTags.includes(t))) continue;
              }
              stacks.push(stack);
            } catch {
              continue;
            }
          }
          bundle.stacks = stacks;
          counts.stacks = stacks.length;
        } catch {
          bundle.stacks = [];
        }
      }

      // Anti-patterns
      if (includeAll) {
        try {
          const apFiles = await readdir(HIVE_DIRS.antipatterns);
          const antipatterns: Record<string, unknown>[] = [];
          for (const file of apFiles.filter((f) => f.endsWith(".yaml"))) {
            try {
              const ap = await readYaml<Record<string, unknown>>(join(HIVE_DIRS.antipatterns, file));
              antipatterns.push(ap);
            } catch {
              continue;
            }
          }
          bundle.antipatterns = antipatterns;
          counts.antipatterns = antipatterns.length;
        } catch {
          bundle.antipatterns = [];
        }
      }

      // Apply sanitization if requested
      let exportData: Record<string, unknown> = bundle;
      if (sanitize) {
        const { result, secretsFound } = sanitizeValue(bundle, rules);
        exportData = result as Record<string, unknown>;
        report.secrets_removed = secretsFound;
        if (secretsFound > 0) {
          report.files_modified.push("(inline content sanitized)");
        }
        report.fields_sanitized = rules.sanitize_fields;
      }

      // Adjust for recipient
      if (recipient) {
        exportData = adjustForRecipient(exportData, recipient);
      }

      // Write export
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const extMap: Record<string, string> = { hive_import: "yaml", markdown: "md", json: "json", zip: "yaml" };
      const ext = extMap[format] ?? "yaml";
      const filePath = output_path ?? join(HIVE_DIRS.exports, `hive-export-${timestamp}.${ext}`);

      const manifest: EnhancedExportManifest = {
        export_date: new Date().toISOString(),
        scope: {
          projects: scope.projects,
          patterns: scope.patterns,
          stacks: scope.stacks,
          tags: scope.tags,
          all: includeAll,
        },
        format,
        recipient,
        sanitized: sanitize,
        counts,
        file_path: filePath,
        sanitization_report: sanitize ? report : undefined,
      };

      const fullExport = { manifest, ...exportData };

      await mkdir(dirname(filePath), { recursive: true });

      if (format === "json") {
        await writeFile(filePath, JSON.stringify(fullExport, null, 2), "utf-8");
      } else if (format === "markdown") {
        const md = toMarkdown(exportData);
        await writeFile(filePath, md, "utf-8");
      } else {
        // hive_import or zip — write as YAML (zip packaging deferred to filesystem tool)
        await writeYaml(filePath, fullExport);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: "Knowledge exported successfully",
                manifest,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
