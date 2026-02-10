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

const DEFAULT_EXPORT_RULES: ExportRules = {
  secrets_patterns: [
    "api[_-]?key",
    "secret",
    "password",
    "token",
    "credential",
    "private[_-]?key",
    "auth[_-]?token",
    "DATABASE_URL",
    "CONNECTION_STRING",
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

function shouldExcludeFile(filePath: string, rules: ExportRules): boolean {
  return rules.exclude_patterns.some((pattern) => {
    if (pattern.startsWith("*")) {
      return filePath.endsWith(pattern.slice(1));
    }
    return filePath.includes(pattern);
  });
}

export function registerPackagePattern(server: McpServer): void {
  server.tool(
    "hive_package_pattern",
    "Package one or more patterns from the knowledge base into a distributable marketplace package. Sanitizes secrets and generates a public preview.",
    {
      patterns: z.array(z.string()).describe("Pattern slugs to include in the package"),
      name: z.string().describe("Package name"),
      description: z.string().describe("Package description"),
      pricing: z
        .object({
          type: z.enum(["free", "paid", "pay_what_you_want"]).describe("Pricing model"),
          price: z.number().optional().describe("Price amount (for paid packages)"),
          currency: z.string().optional().default("USD").describe("Currency code"),
        })
        .describe("Pricing configuration"),
      include_docs: z.boolean().optional().default(false).describe("Include usage documentation"),
      include_decision_guide: z.boolean().optional().default(false).describe("Include decision rationale guide"),
    },
    async ({ patterns: patternSlugs, name, description, pricing, include_docs, include_decision_guide }) => {
      const packageSlug = slugify(name);
      const now = new Date().toISOString().split("T")[0];

      // Load export rules
      let rules: ExportRules;
      try {
        rules = await readYaml<ExportRules>(join(HIVE_DIRS.marketplace, "export-rules.yaml"));
      } catch {
        rules = DEFAULT_EXPORT_RULES;
      }

      // Read and validate patterns
      const loadedPatterns: Pattern[] = [];
      const warnings: string[] = [];

      for (const slug of patternSlugs) {
        try {
          const pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${slug}.yaml`));
          loadedPatterns.push(pattern);
        } catch {
          warnings.push(`Pattern "${slug}" not found — skipped`);
        }
      }

      if (loadedPatterns.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "No valid patterns found to package", warnings }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Filter by confidence (usage count as proxy)
      const filtered = loadedPatterns.filter((p) => {
        if (p.used_in.length < rules.min_usage) {
          warnings.push(`Pattern "${p.slug}" excluded — below minimum usage (${p.used_in.length}/${rules.min_usage})`);
          return false;
        }
        return true;
      });

      // Sanitize pattern files
      const report: SanitizationReport = {
        secrets_removed: 0,
        files_excluded: [],
        files_modified: [],
        fields_sanitized: [],
      };

      const sanitizedPatterns: Array<{ name: string; slug: string; description: string; tags: string[]; files: Array<{ path: string; content: string }> }> = [];

      for (const pattern of filtered) {
        const sanitizedFiles: Array<{ path: string; content: string }> = [];

        for (const file of pattern.files) {
          if (shouldExcludeFile(file.path, rules)) {
            report.files_excluded.push(`${pattern.slug}/${file.path}`);
            continue;
          }

          const { sanitized, secretsFound } = sanitizeContent(file.content, rules);
          if (secretsFound > 0) {
            report.secrets_removed += secretsFound;
            report.files_modified.push(`${pattern.slug}/${file.path}`);
          }
          sanitizedFiles.push({ path: file.path, content: sanitized });
        }

        // Strip sensitive metadata fields
        const sanitized: (typeof sanitizedPatterns)[number] = {
          name: pattern.name,
          slug: pattern.slug,
          description: pattern.description,
          tags: pattern.tags,
          files: sanitizedFiles,
        };

        // Track sanitized fields
        for (const field of rules.sanitize_fields) {
          if (field in pattern && !report.fields_sanitized.includes(field)) {
            report.fields_sanitized.push(field);
          }
        }

        sanitizedPatterns.push(sanitized);
      }

      // Calculate average confidence from usage
      const avgConfidence =
        filtered.length > 0
          ? Math.round((filtered.reduce((sum, p) => sum + p.used_in.length, 0) / filtered.length) * 10) / 10
          : 0;

      // Build manifest
      const totalFiles = sanitizedPatterns.reduce((sum, p) => sum + p.files.length, 0);

      const manifest: PackageManifest = {
        slug: packageSlug,
        name,
        description,
        type: "pattern_bundle",
        version: "1.0.0",
        created: now,
        updated: now,
        pricing,
        source_patterns: filtered.map((p) => p.slug),
        confidence: avgConfidence,
        includes: {
          patterns: sanitizedPatterns.length,
          files: totalFiles,
          docs: include_docs,
          decision_guide: include_decision_guide,
          example_project: false,
        },
        ready_to_publish: sanitizedPatterns.length > 0 && report.secrets_removed === 0,
      };

      // Build preview (no source code)
      const preview: PackagePreview = {
        slug: packageSlug,
        name,
        description,
        type: "pattern_bundle",
        file_tree: sanitizedPatterns.flatMap((p) => p.files.map((f) => `${p.slug}/${f.path}`)),
        pattern_names: sanitizedPatterns.map((p) => p.name),
        confidence_scores: Object.fromEntries(filtered.map((p) => [p.slug, p.used_in.length])),
        tags: [...new Set(filtered.flatMap((p) => p.tags))],
        pricing,
      };

      // Write package files
      const packageDir = join(HIVE_DIRS.marketplacePackages, packageSlug);
      await writeYaml(join(packageDir, "manifest.yaml"), manifest);
      await writeYaml(join(packageDir, "preview.yaml"), preview);

      // Write sanitized contents
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
                message: `Package "${name}" created`,
                package_slug: packageSlug,
                manifest,
                files_included: totalFiles,
                files_sanitized: report.files_modified.length,
                files_excluded: report.files_excluded.length,
                preview,
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
