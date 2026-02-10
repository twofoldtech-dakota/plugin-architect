import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { ComplianceAudit, ComplianceIssue } from "../types/business.js";
import type { Architecture } from "../types/architecture.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

interface ScanContext {
  project: string;
  architecture: Architecture;
  hasPrivacyPolicy: boolean;
  hasTerms: boolean;
  hasContact: boolean;
}

function scanProject(ctx: ScanContext): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const { project, architecture } = ctx;

  // Check for missing privacy policy
  if (!ctx.hasPrivacyPolicy) {
    issues.push({
      project,
      category: "privacy",
      severity: "critical",
      description: "No privacy policy found for this project.",
      fix: 'Generate one with hive_generate_contract type="privacy_policy"',
      auto_fixable: true,
    });
  }

  // Check for missing terms of service
  if (!ctx.hasTerms) {
    issues.push({
      project,
      category: "legal",
      severity: "warning",
      description: "No terms of service found.",
      fix: 'Generate terms with hive_generate_contract type="terms_of_service" or type="saas_terms"',
      auto_fixable: true,
    });
  }

  // Check for missing contact info
  if (!ctx.hasContact) {
    issues.push({
      project,
      category: "accessibility",
      severity: "warning",
      description: "No contact information configured in project architecture.",
      fix: "Add contact information to the project architecture.",
      auto_fixable: false,
    });
  }

  // Check stack for common compliance concerns
  const stack = architecture.stack ?? {};
  const stackValues = Object.values(stack).map((v) => v.toLowerCase());

  // Web apps likely need cookie consent
  const isWebApp = stackValues.some(
    (v) => v.includes("next") || v.includes("react") || v.includes("vue") || v.includes("angular") || v.includes("svelte"),
  );
  if (isWebApp) {
    // Check if any component mentions cookies/consent
    const hasConsent = architecture.components?.some(
      (c) =>
        c.name.toLowerCase().includes("cookie") ||
        c.name.toLowerCase().includes("consent") ||
        c.description?.toLowerCase().includes("cookie") ||
        c.description?.toLowerCase().includes("gdpr"),
    );
    if (!hasConsent) {
      issues.push({
        project,
        category: "privacy",
        severity: "warning",
        description: "Web application detected but no cookie consent component found.",
        fix: "Add a cookie consent banner component to the project.",
        auto_fixable: false,
      });
    }
  }

  // Check for database/user data without GDPR controls
  const hasUserData = architecture.components?.some(
    (c) =>
      c.name.toLowerCase().includes("user") ||
      c.name.toLowerCase().includes("auth") ||
      c.description?.toLowerCase().includes("user data") ||
      c.description?.toLowerCase().includes("personal"),
  );
  if (hasUserData) {
    const hasGdpr = architecture.components?.some(
      (c) =>
        c.name.toLowerCase().includes("gdpr") ||
        c.name.toLowerCase().includes("data export") ||
        c.name.toLowerCase().includes("data deletion") ||
        c.description?.toLowerCase().includes("right to be forgotten"),
    );
    if (!hasGdpr) {
      issues.push({
        project,
        category: "gdpr",
        severity: "warning",
        description: "User data handling detected but no GDPR controls (data export/deletion) found.",
        fix: "Add data export and deletion capabilities for user data.",
        auto_fixable: false,
      });
    }
  }

  // Check for accessibility
  if (isWebApp) {
    const hasA11y = architecture.components?.some(
      (c) =>
        c.name.toLowerCase().includes("accessibility") ||
        c.name.toLowerCase().includes("a11y") ||
        c.description?.toLowerCase().includes("accessibility") ||
        c.description?.toLowerCase().includes("wcag"),
    );
    if (!hasA11y) {
      issues.push({
        project,
        category: "accessibility",
        severity: "info",
        description: "No accessibility (a11y/WCAG) considerations documented in architecture.",
        fix: "Document accessibility approach and add a11y testing.",
        auto_fixable: false,
      });
    }
  }

  return issues;
}

export function registerComplianceScan(server: McpServer): void {
  server.tool(
    "hive_compliance_scan",
    "Scan projects for compliance issues: missing privacy policy, outdated terms, no cookie consent, missing GDPR controls, accessibility gaps.",
    {
      project: z
        .string()
        .optional()
        .describe("Specific project to scan, or omit to scan all projects"),
    },
    async ({ project }) => {
      let projectSlugs: string[];

      if (project) {
        projectSlugs = [project];
      } else {
        try {
          projectSlugs = await readdir(HIVE_DIRS.projects);
        } catch {
          return {
            content: [{ type: "text" as const, text: "No projects found." }],
            isError: true,
          };
        }
      }

      const allIssues: ComplianceIssue[] = [];
      const compliant: string[] = [];
      let scanned = 0;

      // Read generated contracts to check for existing documents
      const contractStorePath = join(HIVE_DIRS.businessContractGenerated, "store.yaml");
      const contracts = await safeRead<{ contracts: Array<{ type: string; project?: string }> }>(contractStorePath);

      for (const slug of projectSlugs) {
        const archPath = join(HIVE_DIRS.projects, slug, "architecture.yaml");
        const architecture = await safeRead<Architecture>(archPath);
        if (!architecture) continue;
        if (architecture.status === "archived") continue;

        scanned++;

        // Check what contracts exist for this project
        const projectContracts = contracts?.contracts.filter((c) => c.project === slug) ?? [];
        const hasPrivacyPolicy = projectContracts.some((c) => c.type === "privacy_policy");
        const hasTerms = projectContracts.some((c) => c.type === "saas_terms" || c.type === "terms_of_service");

        // Check for contact info in architecture
        const hasContact = architecture.components?.some(
          (c) =>
            c.name.toLowerCase().includes("contact") || c.description?.toLowerCase().includes("contact"),
        ) ?? false;

        const issues = scanProject({
          project: slug,
          architecture,
          hasPrivacyPolicy,
          hasTerms,
          hasContact,
        });

        if (issues.length === 0) {
          compliant.push(slug);
        } else {
          allIssues.push(...issues);
        }
      }

      const now = new Date().toISOString();

      // Save audit results
      if (project) {
        const auditPath = join(HIVE_DIRS.businessCompliance, project, "audit.yaml");
        const audit: ComplianceAudit = {
          last_scan: now,
          scanned: 1,
          issues: allIssues,
          compliant: allIssues.length === 0 ? [project] : [],
        };
        await writeYaml(auditPath, audit);
      } else {
        const auditPath = join(HIVE_DIRS.businessCompliance, "latest-scan.yaml");
        const audit: ComplianceAudit = {
          last_scan: now,
          scanned,
          issues: allIssues,
          compliant,
        };
        await writeYaml(auditPath, audit);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                scanned,
                issues: allIssues,
                compliant,
                last_scan: now,
                summary: {
                  total_issues: allIssues.length,
                  by_severity: {
                    critical: allIssues.filter((i) => i.severity === "critical").length,
                    warning: allIssues.filter((i) => i.severity === "warning").length,
                    info: allIssues.filter((i) => i.severity === "info").length,
                  },
                  auto_fixable: allIssues.filter((i) => i.auto_fixable).length,
                },
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
