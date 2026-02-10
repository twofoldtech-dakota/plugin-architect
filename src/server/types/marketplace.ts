// ---- Package Manifest ----

export interface PackagePricing {
  type: "free" | "paid" | "pay_what_you_want";
  price?: number;
  currency?: string;
}

export interface PackageManifest {
  slug: string;
  name: string;
  description: string;
  type: "pattern_bundle" | "stack_bundle";
  version: string;
  created: string;
  updated: string;
  pricing: PackagePricing;
  source_patterns: string[];
  source_stack?: string;
  confidence: number;
  includes: {
    patterns: number;
    files: number;
    docs: boolean;
    decision_guide: boolean;
    example_project: boolean;
  };
  ready_to_publish: boolean;
}

// ---- Package Preview (public — no source code) ----

export interface PackagePreview {
  slug: string;
  name: string;
  description: string;
  type: "pattern_bundle" | "stack_bundle";
  file_tree: string[];
  pattern_names: string[];
  confidence_scores: Record<string, number>;
  tags: string[];
  pricing: PackagePricing;
}

// ---- Package Analytics ----

export interface PackageAnalytics {
  slug: string;
  downloads: number;
  ratings: number[];
  average_rating: number;
  revenue: number;
  first_download?: string;
  last_download?: string;
}

// ---- Export Rules ----

export interface ExportRules {
  secrets_patterns: string[];
  exclude_patterns: string[];
  sanitize_fields: string[];
  min_confidence: number;
  min_usage: number;
}

// ---- Storefront ----

export interface StorefrontConfig {
  display_name: string;
  bio?: string;
  specialties: string[];
  total_packages: number;
  total_downloads: number;
  total_revenue: number;
  joined: string;
}

// ---- Sanitization Report ----

export interface SanitizationReport {
  secrets_removed: number;
  files_excluded: string[];
  files_modified: string[];
  fields_sanitized: string[];
}

// ---- Enhanced Export Manifest (supersedes Phase 10) ----

export interface EnhancedExportManifest {
  export_date: string;
  scope: {
    projects?: string[];
    patterns?: string[];
    stacks?: string[];
    tags?: string[];
    all?: boolean;
  };
  format: "hive_import" | "markdown" | "json" | "zip";
  recipient?: "client" | "collaborator" | "public";
  sanitized: boolean;
  counts: {
    patterns: number;
    stacks: number;
    decisions: number;
    dependencies: number;
    antipatterns: number;
  };
  file_path: string;
  sanitization_report?: SanitizationReport;
}
