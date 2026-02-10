import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { Architecture } from "../types/architecture.js";
import type { DependencySurface } from "../types/dependency.js";

interface Issue {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * Extract import names from source code.
 * Handles: import X from "pkg", import { X } from "pkg", require("pkg"), import("pkg")
 */
function extractImports(code: string): string[] {
  const imports: string[] = [];
  const lines = code.split("\n");

  for (const line of lines) {
    // ES import: import ... from "package"
    const esMatch = line.match(/import\s+.*?from\s+["']([^"']+)["']/);
    if (esMatch) {
      imports.push(esMatch[1]);
      continue;
    }

    // Side-effect import: import "package"
    const sideEffectMatch = line.match(/^\s*import\s+["']([^"']+)["']/);
    if (sideEffectMatch) {
      imports.push(sideEffectMatch[1]);
      continue;
    }

    // require: require("package")
    const requireMatch = line.match(/require\(["']([^"']+)["']\)/);
    if (requireMatch) {
      imports.push(requireMatch[1]);
      continue;
    }

    // Dynamic import: import("package")
    const dynamicMatch = line.match(/import\(["']([^"']+)["']\)/);
    if (dynamicMatch) {
      imports.push(dynamicMatch[1]);
    }
  }

  return imports;
}

/**
 * Get the package name from an import specifier (strips subpaths).
 * "@scope/pkg/sub" → "@scope/pkg", "pkg/sub" → "pkg"
 */
function getPackageName(importPath: string): string | null {
  // Skip relative imports
  if (importPath.startsWith(".") || importPath.startsWith("/")) return null;
  // Skip node builtins
  if (importPath.startsWith("node:")) return null;

  if (importPath.startsWith("@")) {
    const parts = importPath.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
  }

  return importPath.split("/")[0];
}

/**
 * Extract named imports/usages from import statements for a specific package.
 */
function extractNamedImports(code: string, packageName: string): string[] {
  const names: string[] = [];
  const lines = code.split("\n");

  for (const line of lines) {
    // Match: import { X, Y } from "package" or import { X, Y } from "@scope/package"
    const match = line.match(new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']${escapeRegex(packageName)}[^"']*["']`));
    if (match) {
      const items = match[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
      names.push(...items.filter(Boolean));
    }
  }

  return names;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function registerValidateCode(server: McpServer): void {
  server.tool(
    "hive_validate_code",
    "Validate code against registered dependencies. Checks imports, signatures, and known gotchas.",
    {
      code: z.string().describe("The source code to validate"),
      file_path: z.string().describe("The file path (for context in error messages)"),
      project: z.string().describe("Project slug (to check against project stack)"),
    },
    async ({ code, file_path, project }) => {
      const issues: Issue[] = [];

      // Read project architecture for stack context
      let architecture: Architecture | null = null;
      try {
        architecture = await readYaml<Architecture>(join(HIVE_DIRS.projects, project, "architecture.yaml"));
      } catch {
        issues.push({
          severity: "warning",
          message: `Project "${project}" not found — cannot validate against project stack.`,
        });
      }

      // Extract imports from the code
      const importPaths = extractImports(code);
      const packageNames = importPaths.map(getPackageName).filter((p): p is string => p !== null);
      const uniquePackages = [...new Set(packageNames)];

      // List all registered dependencies
      let registeredDeps: string[] = [];
      try {
        registeredDeps = await readdir(HIVE_DIRS.dependencies);
      } catch {
        // No dependencies registered
      }

      // Check each imported package
      for (const pkg of uniquePackages) {
        if (!registeredDeps.includes(pkg)) {
          // Check if it's in the project stack
          const inStack = architecture?.stack && Object.values(architecture.stack).some(
            (v) => typeof v === "string" && v.toLowerCase().includes(pkg.toLowerCase()),
          );

          issues.push({
            severity: inStack ? "info" : "warning",
            message: `Import "${pkg}" is not a registered dependency.`,
            suggestion: `Register it with hive_register_dependency to enable API surface validation.`,
          });
          continue;
        }

        // Read the dependency surface
        let surface: DependencySurface;
        try {
          surface = await readYaml<DependencySurface>(join(HIVE_DIRS.dependencies, pkg, "surface.yaml"));
        } catch {
          continue;
        }

        // Check named imports against known exports
        const namedImports = extractNamedImports(code, pkg);
        if (surface.exports && namedImports.length > 0) {
          const knownExportNames = surface.exports.map((e) => e.name);
          for (const name of namedImports) {
            if (!knownExportNames.includes(name)) {
              issues.push({
                severity: "error",
                message: `"${name}" is not a known export of "${pkg}".`,
                suggestion: `Known exports: ${knownExportNames.slice(0, 10).join(", ")}${knownExportNames.length > 10 ? "..." : ""}`,
              });
            }
          }
        }

        // Check against known gotchas
        if (surface.gotchas && surface.gotchas.length > 0) {
          for (const gotcha of surface.gotchas) {
            // Simple keyword matching — check if the gotcha's key terms appear in the code
            const gotchaTerms = gotcha.toLowerCase().split(/\s+/).filter((t) => t.length > 4);
            const codeHasRelevance = gotchaTerms.some((term) => code.toLowerCase().includes(term));
            if (codeHasRelevance) {
              issues.push({
                severity: "warning",
                message: `Gotcha for "${pkg}": ${gotcha}`,
              });
            }
          }
        }
      }

      const verified = issues.filter((i) => i.severity === "error").length === 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                file: file_path,
                imports_found: uniquePackages,
                issues,
                verified,
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
