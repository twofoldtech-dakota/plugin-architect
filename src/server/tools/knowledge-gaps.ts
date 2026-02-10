import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture, DecisionLog } from "../types/architecture.js";
import type { Pattern, PatternIndex } from "../types/pattern.js";

interface UnregisteredPattern {
  suggested_name: string;
  evidence: string[];
  found_in_projects: string[];
}

interface UnregisteredDep {
  name: string;
  used_in_projects: string[];
}

interface PotentialAntipattern {
  description: string;
  evidence: string;
  projects: string[];
}

interface KnowledgeGapsResult {
  scope: string;
  unregistered_patterns: UnregisteredPattern[];
  unregistered_deps: UnregisteredDep[];
  potential_antipatterns: PotentialAntipattern[];
  summary: string;
}

export function registerKnowledgeGaps(server: McpServer): void {
  server.tool(
    "hive_knowledge_gaps",
    "Scan all project architectures, decisions, and code patterns to find knowledge that should be registered but hasn't been. Identifies unregistered patterns, unregistered dependencies, and potential anti-patterns.",
    {
      scope: z
        .string()
        .optional()
        .default("all")
        .describe('Scope: "all" to scan everything, or a project slug to scan one project'),
    },
    async ({ scope }) => {
      let projectDirs: string[];
      try {
        projectDirs = await readdir(HIVE_DIRS.projects);
      } catch {
        return {
          content: [{ type: "text" as const, text: "No projects found." }],
        };
      }

      if (scope !== "all") {
        if (!projectDirs.includes(scope)) {
          return {
            content: [{ type: "text" as const, text: `Project "${scope}" not found.` }],
            isError: true,
          };
        }
        projectDirs = [scope];
      }

      // Load registered patterns and deps for comparison
      const registeredPatternSlugs = new Set<string>();
      const registeredPatternTags = new Set<string>();
      try {
        const index = await readYaml<PatternIndex>(join(HIVE_DIRS.patterns, "index.yaml"));
        for (const entry of index.patterns) {
          registeredPatternSlugs.add(entry.slug);
          for (const tag of entry.tags) {
            registeredPatternTags.add(tag.toLowerCase());
          }
        }
      } catch {
        // No patterns index
      }

      const registeredDeps = new Set<string>();
      try {
        const depDirs = await readdir(HIVE_DIRS.dependencies);
        for (const d of depDirs) {
          registeredDeps.add(d.toLowerCase());
        }
      } catch {
        // No deps
      }

      // Track component types across projects to find repeated patterns
      const componentTypeMap = new Map<string, string[]>(); // type -> projects
      const stackDepMap = new Map<string, string[]>(); // dep name -> projects
      const revisitTriggers: PotentialAntipattern[] = [];
      const revertedDecisions: PotentialAntipattern[] = [];

      for (const dir of projectDirs) {
        const projDir = join(HIVE_DIRS.projects, dir);

        let arch: Architecture;
        try {
          arch = await readYaml<Architecture>(join(projDir, "architecture.yaml"));
        } catch {
          continue;
        }

        if (arch.status === "archived") continue;

        // Track component types for pattern detection
        for (const comp of arch.components) {
          const typeKey = comp.type.toLowerCase();
          if (!componentTypeMap.has(typeKey)) componentTypeMap.set(typeKey, []);
          if (!componentTypeMap.get(typeKey)!.includes(dir)) {
            componentTypeMap.get(typeKey)!.push(dir);
          }
        }

        // Track stack dependencies
        for (const value of Object.values(arch.stack)) {
          const depName = String(value).toLowerCase();
          if (!stackDepMap.has(depName)) stackDepMap.set(depName, []);
          if (!stackDepMap.get(depName)!.includes(dir)) {
            stackDepMap.get(depName)!.push(dir);
          }
        }

        // Analyze decisions for anti-patterns
        let decisions: DecisionLog | null = null;
        try {
          decisions = await readYaml<DecisionLog>(join(projDir, "decisions.yaml"));
        } catch {
          continue;
        }

        if (!decisions) continue;

        // Look for revisit_when triggers that may indicate tech debt
        for (const d of decisions.decisions) {
          if (d.revisit_when) {
            // Check if this revisit trigger is similar to one already found
            const existing = revisitTriggers.find(
              (r) => r.description.toLowerCase().includes(d.component.toLowerCase()),
            );
            if (existing) {
              if (!existing.projects.includes(dir)) existing.projects.push(dir);
            } else {
              revisitTriggers.push({
                description: `Decision on "${d.component}" flagged for revisit: "${d.revisit_when}"`,
                evidence: `Decision ${d.id}: ${d.decision}`,
                projects: [dir],
              });
            }
          }
        }

        // Look for reverted or contradicting decisions (same component, opposite decisions)
        const componentDecisions = new Map<string, typeof decisions.decisions>();
        for (const d of decisions.decisions) {
          const key = d.component.toLowerCase();
          if (!componentDecisions.has(key)) componentDecisions.set(key, []);
          componentDecisions.get(key)!.push(d);
        }

        for (const [comp, decs] of componentDecisions) {
          if (decs.length >= 3) {
            revertedDecisions.push({
              description: `Component "${comp}" has ${decs.length} decisions — may indicate indecision or repeated issues`,
              evidence: decs.map((d) => `${d.id}: ${d.decision}`).join("; "),
              projects: [dir],
            });
          }
        }
      }

      // --- Find unregistered patterns ---
      const unregisteredPatterns: UnregisteredPattern[] = [];
      for (const [compType, projects] of componentTypeMap) {
        // If a component type appears in 2+ projects but isn't a registered pattern tag
        if (projects.length >= 2 && !registeredPatternTags.has(compType)) {
          unregisteredPatterns.push({
            suggested_name: `${compType}-pattern`,
            evidence: [`Component type "${compType}" found in ${projects.length} projects but no matching pattern registered`],
            found_in_projects: projects,
          });
        }
      }

      // --- Find unregistered dependencies ---
      const unregisteredDeps: UnregisteredDep[] = [];
      for (const [dep, projects] of stackDepMap) {
        if (!registeredDeps.has(dep) && dep.length > 1) {
          unregisteredDeps.push({
            name: dep,
            used_in_projects: projects,
          });
        }
      }

      // Sort by usage count
      unregisteredDeps.sort((a, b) => b.used_in_projects.length - a.used_in_projects.length);

      // --- Combine anti-patterns ---
      const potentialAntipatterns: PotentialAntipattern[] = [
        ...revisitTriggers.filter((r) => r.projects.length >= 2),
        ...revertedDecisions,
      ];

      // --- Summary ---
      const parts: string[] = [];
      if (unregisteredPatterns.length > 0) {
        parts.push(`${unregisteredPatterns.length} potential pattern(s) to register`);
      }
      if (unregisteredDeps.length > 0) {
        parts.push(`${unregisteredDeps.length} unregistered dependency/dependencies`);
      }
      if (potentialAntipatterns.length > 0) {
        parts.push(`${potentialAntipatterns.length} potential anti-pattern(s) detected`);
      }

      const summary =
        parts.length > 0
          ? `Knowledge gaps found: ${parts.join(", ")}.`
          : "No significant knowledge gaps detected — knowledge base is comprehensive.";

      const result: KnowledgeGapsResult = {
        scope,
        unregistered_patterns: unregisteredPatterns,
        unregistered_deps: unregisteredDeps,
        potential_antipatterns: potentialAntipatterns,
        summary,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
