import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { BuildPlan, BuildPhase, BuildTask } from "../types/build-plan.js";

function makeTaskId(phaseIdx: number, taskIdx: number): string {
  return `p${phaseIdx + 1}t${taskIdx + 1}`;
}

/**
 * Derive a phased build plan from an architecture spec.
 *
 * Strategy: topological sort on component dependencies, then group into phases
 * where each phase contains components whose dependencies are all in earlier phases.
 */
function derivePhases(architecture: Architecture): BuildPhase[] {
  const components = architecture.components;
  if (components.length === 0) return [];

  // Build adjacency: component name → set of dependency names
  const depMap = new Map<string, Set<string>>();
  const nameSet = new Set<string>();
  for (const c of components) {
    nameSet.add(c.name);
    depMap.set(c.name, new Set(c.dependencies.filter((d) => components.some((cc) => cc.name === d))));
  }

  // Kahn's algorithm to group into layers (phases)
  const layers: string[][] = [];
  const placed = new Set<string>();

  while (placed.size < components.length) {
    const layer: string[] = [];
    for (const c of components) {
      if (placed.has(c.name)) continue;
      const deps = depMap.get(c.name)!;
      if ([...deps].every((d) => placed.has(d))) {
        layer.push(c.name);
      }
    }

    // If no progress, break cycles by picking the first unplaced component
    if (layer.length === 0) {
      const unplaced = components.find((c) => !placed.has(c.name))!;
      layer.push(unplaced.name);
    }

    layers.push(layer);
    for (const name of layer) placed.add(name);
  }

  // Convert layers to BuildPhases
  return layers.map((layer, phaseIdx) => {
    const tasks: BuildTask[] = layer.map((name, taskIdx) => {
      const comp = components.find((c) => c.name === name)!;
      // Depend on tasks in earlier phases that this component depends on
      const taskDeps: string[] = [];
      for (const dep of comp.dependencies) {
        for (let pi = 0; pi < phaseIdx; pi++) {
          const ti = layers[pi].indexOf(dep);
          if (ti !== -1) taskDeps.push(makeTaskId(pi, ti));
        }
      }

      return {
        id: makeTaskId(phaseIdx, taskIdx),
        name: `Build ${comp.name}`,
        description: `Implement the ${comp.name} component: ${comp.description}`,
        depends_on: taskDeps,
        status: "pending" as const,
        component: comp.name,
        expected_files: comp.files,
        file_changes: [],
      };
    });

    return {
      id: `phase-${phaseIdx + 1}`,
      name: `Phase ${phaseIdx + 1}`,
      description: `Build: ${layer.join(", ")}`,
      tasks,
      status: "pending" as const,
      checkpoint: true,
    };
  });
}

export function registerPlanBuild(server: McpServer): void {
  server.tool(
    "hive_plan_build",
    "Take a product description and output a phased build plan with tasks, dependencies, and execution order. Requires an existing Hive project with an architecture spec.",
    {
      project: z.string().describe("Project slug (must already have an architecture.yaml)"),
      description: z.string().describe("Product description — what you want to build"),
    },
    async ({ project, description }) => {
      const archPath = join(HIVE_DIRS.projects, project, "architecture.yaml");

      let architecture: Architecture;
      try {
        architecture = await readYaml<Architecture>(archPath);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${project}" not found or missing architecture.yaml.` }],
          isError: true,
        };
      }

      if (architecture.components.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Architecture has no components. Add components to the architecture before planning a build.",
            },
          ],
          isError: true,
        };
      }

      const phases = derivePhases(architecture);
      const now = new Date().toISOString().split("T")[0];

      const plan: BuildPlan = {
        project,
        description,
        created: now,
        updated: now,
        status: "planning",
        current_phase: 0,
        phases,
        session_id: randomUUID(),
      };

      const planPath = join(HIVE_DIRS.projects, project, "build-plan.yaml");
      await writeYaml(planPath, plan);

      // Summarize for the caller
      const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0);
      const summary = {
        message: `Build plan created with ${phases.length} phases and ${totalTasks} tasks.`,
        plan_path: planPath,
        phases: phases.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          task_count: p.tasks.length,
          tasks: p.tasks.map((t) => ({ id: t.id, name: t.name, depends_on: t.depends_on })),
        })),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      };
    },
  );
}
