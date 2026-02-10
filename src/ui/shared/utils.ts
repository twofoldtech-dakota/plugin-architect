/**
 * Hive — shared UI utilities
 */

/** Merge class name strings, filtering out falsy values. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
