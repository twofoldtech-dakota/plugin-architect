import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { Pattern } from "../types/pattern.js";
import type {
  PackageManifest,
  PackagePreview,
  PackageAnalytics,
  ExportRules,
  SanitizationReport,
} from "../types/marketplace.js";

interface StackPreset {
  name: string;
  description: string;
  tags: string[];
  stack: Record<string, string>;
  patterns?: string[];
  file_structure?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  dev_dependencies?: Record<string, string>;
}

const DEFAULT_EXPORT_RULES: ExportRules = {
  secrets_patterns: [
    "api[_-]?key",
    "secret",
    "password",
    "token",
    "credential",
    "private[_-]?key",
  ],
  exclude_patterns: [".env", "*.pem", "*.key", "credentials.*"],
  sanitize_fields: ["source", "learned_from", "used_in"],
  min_confidence: 2,
  min_usage: 0,
};

function sanitizeContent(content: string, rules: ExportRules): { sanitized: string; secretsFound: number } {
  let sanitized = content;
  let secretsFound = 0;

  for (const pattern of rules.secrets_patterns) {
    const regex = new RegExp(`(${pattern})\\s*[:=]\\s*["']?[^"'\\s]+["']?`, "gi");
    const matches = sanitized.match(regex);
    if (matches) {
      secretsFound += matches.length;
      sanitized = sanitized.replace(regex, `$1: "[REDACTED]"`);
    }
  }

  return { sanitized, secretsFound };
}

function flattenFileStructure(structure: Record<string, unknown>, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(structure)) {
    const fullPath = prefix ? `${prefix}/${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...flattenFileStructure(value as Record<string, unknown>, fullPath));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export function registerPackageStack(server: McpServer): void {
  server.tool(
    "hive_package_stack",
    "Package a stack preset (with its patterns) into a distributable marketplace package. Includes setup guide and architecture overview.",
    {
      stack: z.string().describe("Stack preset slug (e.g., 'next-drizzle-sqlite')"),
      name: z.string().describe("Package name"),
      description: z.string().describe("Package description"),
      pricing: z
        .object({
          type: z.enum(["free", "paid", "pay_what_you_want"]).describe("Pricing model"),
          price: z.number().optional().describe("Price amount (for paid packages)"),
          currency: z.string().optional().default("USD").describe("Currency code"),
        })
        .describe("Pricing configuration"),
      extras: z
        .object({
          include_patterns: z.boolean().optional().default(true).describe("Include referenced patterns"),
          include_example_project: z.boolean().optional().default(false).describe("Include example project scaffold"),
          include_docs: z.boolean().optional().default(true).describe("Include setup documentation"),
        })
        .optional()
        .describe("Optional extras to include"),
    },
    async ({ stack, name, description, pricing, extras }) => {
      const packageSlug = slugify(name);
      const now = new Date().toISOString().split("T")[0];
      const includePatterns = extras?.include_patterns ?? true;
      const includeExampleProject = extras?.include_example_project ?? false;
      const includeDocs = extras?.include_docs ?? true;

      // Read stack preset
      let preset: StackPreset;
      try {
        preset = await readYaml<StackPreset>(join(HIVE_DIRS.stacks, `${stack}.yaml`));
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Stack preset "${stack}" not found.` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Load export rules
      let rules: ExportRules;
      try {
        rules = await readYaml<ExportRules>(join(HIVE_DIRS.marketplace, "export-rules.yaml"));
      } catch {
        rules = DEFAULT_EXPORT_RULES;
      }

      // Read referenced patterns
      const loadedPatterns: Pattern[] = [];
      const warnings: string[] = [];

      if (includePatterns && preset.patterns) {
        for (const slug of preset.patterns) {
          try {
            const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${slug}.yaml`));
            loadedPatterns.push(pattern);
          } catch {
            warnings.push(`Pattern "${slug}" referenced by stack but not found — skipped`);
          }
        }
      }

      // Sanitize
      const report: SanitizationReport = {
        secrets_removed: 0,
        files_excluded: [],
        files_modified: [],
        fields_sanitized: [],
      };

      const sanitizedPatterns: Array<{ name: string; slug: string; description: string; tags: string[]; files: Array<{ path: string; content: string }> }> = [];

      for (const pattern of loadedPatterns) {
        const sanitizedFiles: Array<{ path: string; content: string }> = [];

        for (const file of pattern.files) {
          const { sanitized, secretsFound } = sanitizeContent(file.content, rules);
          if (secretsFound > 0) {
            report.secrets_removed += secretsFound;
            report.files_modified.push(`${pattern.slug}/${file.path}`);
          }
          sanitizedFiles.push({ path: file.path, content: sanitized });
        }

        sanitizedPatterns.push({
          name: pattern.name,
          slug: pattern.slug,
          description: pattern.description,
          tags: pattern.tags,
          files: sanitizedFiles,
        });
      }

      // Generate setup guide
      const setupGuide = includeDocs
        ? {
            title: `${name} — Setup Guide`,
            stack: preset.stack,
            steps: [
              "Install dependencies from package.json",
              ...(preset.patterns?.length ? ["Review included patterns in the contents/ directory"] : []),
              "Follow the file structure to organize your project",
              "Customize configuration files for your use case",
            ],
            dependencies: preset.dependencies ?? {},
            dev_dependencies: preset.dev_dependencies ?? {},
          }
        : undefined;

      // Generate architecture overview
      const architectureOverview = {
        stack: preset.stack,
        tags: preset.tags,
        file_structure: preset.file_structure ?? {},
        patterns_included: sanitizedPatterns.map((p) => ({ name: p.name, description: p.description, tags: p.tags })),
      };

      // Generate example project info
      const exampleProject = includeExampleProject
        ? {
            file_tree: preset.file_structure ? flattenFileStructure(preset.file_structure) : [],
            dependencies: preset.dependencies ?? {},
            dev_dependencies: preset.dev_dependencies ?? {},
          }
        : undefined;

      // Build manifest
      const totalFiles = sanitizedPatterns.reduce((sum, p) => sum + p.files.length, 0);
      const avgConfidence =
        loadedPatterns.length > 0
          ? Math.round((loadedPatterns.reduce((sum, p) => sum + p.used_in.length, 0) / loadedPatterns.length) * 10) / 10
          : 0;

      const manifest: PackageManifest = {
        slug: packageSlug,
        name,
        description,
        type: "stack_bundle",
        version: "1.0.0",
        created: now,
        updated: now,
        pricing,
        source_patterns: loadedPatterns.map((p) => p.slug),
        source_stack: stack,
        confidence: avgConfidence,
        includes: {
          patterns: sanitizedPatterns.length,
          files: totalFiles,
          docs: includeDocs,
          decision_guide: false,
          example_project: includeExampleProject,
        },
        ready_to_publish: report.secrets_removed === 0,
      };

      // Build preview
      const preview: PackagePreview = {
        slug: packageSlug,
        name,
        description,
        type: "stack_bundle",
        file_tree: [
          ...(preset.file_structure ? flattenFileStructure(preset.file_structure) : []),
          ...sanitizedPatterns.flatMap((p) => p.files.map((f) => `patterns/${p.slug}/${f.path}`)),
        ],
        pattern_names: sanitizedPatterns.map((p) => p.name),
        confidence_scores: Object.fromEntries(loadedPatterns.map((p) => [p.slug, p.used_in.length])),
        tags: [...new Set([...preset.tags, ...sanitizedPatterns.flatMap((p) => p.tags)])],
        pricing,
      };

      // Write package files
      const packageDir = join(HIVE_DIRS.marketplacePackages, packageSlug);
      await writeYaml(join(packageDir, "manifest.yaml"), manifest);
      await writeYaml(join(packageDir, "preview.yaml"), preview);
      await writeYaml(join(packageDir, "stack-config.yaml"), { preset: preset.stack, tags: preset.tags, file_structure: preset.file_structure });

      if (setupGuide) {
        await writeYaml(join(packageDir, "setup-guide.yaml"), setupGuide);
      }
      if (architectureOverview) {
        await writeYaml(join(packageDir, "architecture-overview.yaml"), architectureOverview);
      }
      if (exampleProject) {
        await writeYaml(join(packageDir, "example-project.yaml"), exampleProject);
      }

      for (const pattern of sanitizedPatterns) {
        await writeYaml(join(packageDir, "contents", `${pattern.slug}.yaml`), pattern);
      }

      // Initialize analytics
      const analytics: PackageAnalytics = {
        slug: packageSlug,
        downloads: 0,
        ratings: [],
        average_rating: 0,
        revenue: 0,
      };
      await writeYaml(join(packageDir, "analytics.yaml"), analytics);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Stack package "${name}" created`,
                package_slug: packageSlug,
                manifest,
                stack_config: preset.stack,
                patterns_included: sanitizedPatterns.length,
                example_project: exampleProject ? { file_count: exampleProject.file_tree.length } : null,
                documentation: setupGuide ? "included" : "not included",
                warnings,
                sanitization_report: report,
                ready_to_publish: manifest.ready_to_publish,
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
