import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { ChangelogEntry } from "../types/marketing.js";

const execAsync = promisify(exec);

export function registerAutoChangelog(server: McpServer): void {
  server.tool(
    "hive_auto_changelog",
    "Auto-generate a changelog from git history, decision log, and architecture changes.",
    {
      project: z.string().describe("Project slug"),
      since: z.string().optional().describe("Date (YYYY-MM-DD) or git ref to generate changelog since"),
      format: z
        .enum(["keep-a-changelog", "conventional", "narrative"])
        .optional()
        .default("keep-a-changelog")
        .describe('Changelog format (default: "keep-a-changelog")'),
    },
    async ({ project, since, format }) => {
      const archPath = join(HIVE_DIRS.projects, safeName(project), "architecture.yaml");

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(archPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found.` }],
          isError: true,
        };
      }

      let decisions: DecisionLog = { decisions: [] };
      try {
        decisions = await readYaml<DecisionLog>(join(HIVE_DIRS.projects, safeName(project), "decisions.yaml"));
      } catch {
        // No decisions
      }

      const sinceDate = since ?? "1970-01-01";
      const today = new Date().toISOString().split("T")[0];

      // Filter decisions since the given date
      const recentDecisions = decisions.decisions.filter((d) => d.date >= sinceDate);

      // Categorize changes from decisions
      const added: string[] = [];
      const changed: string[] = [];
      const fixed: string[] = [];
      const removed: string[] = [];

      for (const d of recentDecisions) {
        const text = `${d.component}: ${d.decision}`;
        const lower = d.decision.toLowerCase();

        if (lower.includes("add") || lower.includes("create") || lower.includes("implement") || lower.includes("introduce")) {
          added.push(text);
        } else if (lower.includes("remove") || lower.includes("delete") || lower.includes("drop") || lower.includes("deprecate")) {
          removed.push(text);
        } else if (lower.includes("fix") || lower.includes("repair") || lower.includes("patch") || lower.includes("resolve")) {
          fixed.push(text);
        } else {
          changed.push(text);
        }
      }

      // If no decisions, derive from architecture components
      if (recentDecisions.length === 0) {
        for (const c of architecture.components) {
          added.push(`${c.name}: ${c.description}`);
        }
      }

      // Try to get git commits if available
      const sourceCommits: string[] = [];
      // Check if any file_structure paths exist to guess a project path
      // We'll try the project slug as a directory name in common locations
      try {
        const { stdout } = await execAsync(`git log --oneline --since="${sinceDate}" --no-merges 2>/dev/null | head -20`, {
          timeout: 10000,
        });
        const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
        for (const line of lines) {
          sourceCommits.push(line.trim());
          const lower = line.toLowerCase();
          if (lower.includes("add") || lower.includes("feat")) {
            added.push(line.trim());
          } else if (lower.includes("fix")) {
            fixed.push(line.trim());
          } else if (lower.includes("remove") || lower.includes("delete")) {
            removed.push(line.trim());
          } else {
            changed.push(line.trim());
          }
        }
      } catch {
        // Not in a git repo or git not available
      }

      const entry: ChangelogEntry = {
        date: today,
        added,
        changed,
        fixed,
        removed,
        source_commits: sourceCommits.length > 0 ? sourceCommits : undefined,
        source_decisions: recentDecisions.length > 0 ? recentDecisions.map((d) => d.id) : undefined,
      };

      // Generate highlights
      const totalChanges = added.length + changed.length + fixed.length + removed.length;
      entry.highlights = `${totalChanges} changes: ${added.length} added, ${changed.length} changed, ${fixed.length} fixed, ${removed.length} removed`;

      // Format output based on requested format
      let formatted: string;

      switch (format) {
        case "keep-a-changelog": {
          const sections: string[] = [`## [Unreleased] — ${today}`];
          if (added.length > 0) sections.push(`\n### Added\n${added.map((a) => `- ${a}`).join("\n")}`);
          if (changed.length > 0) sections.push(`\n### Changed\n${changed.map((c) => `- ${c}`).join("\n")}`);
          if (fixed.length > 0) sections.push(`\n### Fixed\n${fixed.map((f) => `- ${f}`).join("\n")}`);
          if (removed.length > 0) sections.push(`\n### Removed\n${removed.map((r) => `- ${r}`).join("\n")}`);
          formatted = sections.join("\n");
          break;
        }

        case "conventional": {
          const lines: string[] = [];
          for (const a of added) lines.push(`feat: ${a}`);
          for (const c of changed) lines.push(`refactor: ${c}`);
          for (const f of fixed) lines.push(`fix: ${f}`);
          for (const r of removed) lines.push(`chore: remove ${r}`);
          formatted = lines.join("\n");
          break;
        }

        case "narrative": {
          const parts: string[] = [`# What's New — ${today}\n`];
          if (added.length > 0)
            parts.push(`We've added ${added.length} new features:\n${added.map((a) => `- ${a}`).join("\n")}\n`);
          if (changed.length > 0) parts.push(`We've improved ${changed.length} areas:\n${changed.map((c) => `- ${c}`).join("\n")}\n`);
          if (fixed.length > 0) parts.push(`We've fixed ${fixed.length} issues:\n${fixed.map((f) => `- ${f}`).join("\n")}\n`);
          if (removed.length > 0) parts.push(`We've cleaned up ${removed.length} items:\n${removed.map((r) => `- ${r}`).join("\n")}\n`);
          formatted = parts.join("\n");
          break;
        }
      }

      // Save changelog
      const changelogPath = join(HIVE_DIRS.marketing, safeName(project), "changelog.yaml");
      let existingEntries: ChangelogEntry[] = [];
      try {
        const existing = await readYaml<{ entries: ChangelogEntry[] }>(changelogPath);
        existingEntries = existing.entries;
      } catch {
        // No existing changelog
      }

      existingEntries.unshift(entry);
      await writeYaml(changelogPath, { entries: existingEntries });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Changelog generated for "${project}" since ${sinceDate}`,
                format,
                entry,
                formatted,
                saved_to: `marketing/${project}/changelog.yaml`,
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
