import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, access } from "node:fs/promises";

export const HIVE_ROOT = join(homedir(), ".hive");

export const HIVE_DIRS = {
  ideas: join(HIVE_ROOT, "ideas"),
  projects: join(HIVE_ROOT, "projects"),
  patterns: join(HIVE_ROOT, "knowledge", "patterns"),
  dependencies: join(HIVE_ROOT, "knowledge", "dependencies"),
  stacks: join(HIVE_ROOT, "knowledge", "stacks"),
  antipatterns: join(HIVE_ROOT, "knowledge", "antipatterns"),
  templates: join(HIVE_ROOT, "templates"),
} as const;

const CONFIG_PATH = join(HIVE_ROOT, "config.yaml");

const DEFAULT_CONFIG = `# Hive configuration
version: 1
`;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize ~/.hive/ directory structure on first run.
 * Safe to call multiple times — only creates what's missing.
 */
export async function initHiveDir(): Promise<void> {
  for (const dir of Object.values(HIVE_DIRS)) {
    await mkdir(dir, { recursive: true });
  }

  if (!(await exists(CONFIG_PATH))) {
    await writeFile(CONFIG_PATH, DEFAULT_CONFIG, "utf-8");
  }
}
