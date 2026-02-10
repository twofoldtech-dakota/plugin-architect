/**
 * Convert a name to a URL-safe slug for use as file names.
 *
 * "My Cool Project!" → "my-cool-project"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validate that a user-supplied slug/name is safe to use as a path component.
 * Prevents path traversal attacks (e.g. "../../etc").
 * Throws if the value is unsafe.
 */
export function safeName(value: string): string {
  if (!value || value.includes("/") || value.includes("\\") || value === "." || value === "..") {
    throw new Error(`Invalid name: "${value}"`);
  }
  return value;
}
