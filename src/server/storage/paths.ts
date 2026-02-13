import { homedir } from "node:os";
import { join } from "node:path";

export const HIVE_ROOT = join(homedir(), ".hive");
export const DB_PATH = join(HIVE_ROOT, "hive.db");
