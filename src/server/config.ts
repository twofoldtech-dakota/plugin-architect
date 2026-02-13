import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HIVE_ROOT } from "./storage/paths.js";

/**
 * Tool categories that can be individually enabled/disabled.
 * When `categories` is omitted or set to "all", every category is registered.
 * When set to an array, only those categories are registered.
 */
export const TOOL_CATEGORIES = [
  "discovery",
  "foundation",
  "validation",
  "acceleration",
  "intelligence",
  "cross-project",
  "build",
  "project-management",
  "revenue",
  "business",
  "workflow",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface HiveConfig {
  /** Which tool categories to register. Defaults to all. */
  categories: ToolCategory[] | "all";
}

const CONFIG_PATH = join(HIVE_ROOT, "config.json");

const DEFAULT_CONFIG: HiveConfig = {
  categories: "all",
};

export function loadConfig(): HiveConfig {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;

  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    const categories = raw.categories;

    if (categories === undefined || categories === "all") {
      return { ...DEFAULT_CONFIG, ...raw, categories: "all" };
    }

    if (Array.isArray(categories)) {
      const valid = categories.filter((c: string) =>
        (TOOL_CATEGORIES as readonly string[]).includes(c),
      );
      return { ...DEFAULT_CONFIG, ...raw, categories: valid as ToolCategory[] };
    }

    return DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function isCategoryEnabled(config: HiveConfig, category: ToolCategory): boolean {
  if (config.categories === "all") return true;
  return config.categories.includes(category);
}
