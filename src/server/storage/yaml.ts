import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, stringify } from "yaml";

/**
 * Read and parse a YAML file. Returns typed object.
 * Throws if the file does not exist or is invalid YAML.
 */
export async function readYaml<T = unknown>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return parse(raw) as T;
}

/**
 * Serialize an object and write it to a YAML file.
 * Auto-creates parent directories if they don't exist.
 */
export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const content = stringify(data, { lineWidth: 120 });
  await writeFile(filePath, content, "utf-8");
}
