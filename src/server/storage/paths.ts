import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, access } from "node:fs/promises";

export const HIVE_ROOT = join(homedir(), ".hive");

export const HIVE_DIRS = {
  root: HIVE_ROOT,
  ideas: join(HIVE_ROOT, "ideas"),
  projects: join(HIVE_ROOT, "projects"),
  patterns: join(HIVE_ROOT, "knowledge", "patterns"),
  dependencies: join(HIVE_ROOT, "knowledge", "dependencies"),
  stacks: join(HIVE_ROOT, "knowledge", "stacks"),
  antipatterns: join(HIVE_ROOT, "knowledge", "antipatterns"),
  templates: join(HIVE_ROOT, "templates"),
  fleet: join(HIVE_ROOT, "fleet"),
  revenue: join(HIVE_ROOT, "revenue"),
  revenueSnapshots: join(HIVE_ROOT, "revenue", "snapshots"),
  revenueExperiments: join(HIVE_ROOT, "revenue", "experiments"),
  revenueForecasts: join(HIVE_ROOT, "revenue", "forecasts"),
  retrospectives: join(HIVE_ROOT, "retrospectives"),
  metrics: join(HIVE_ROOT, "metrics"),
  maintenance: join(HIVE_ROOT, "maintenance"),
  exports: join(HIVE_ROOT, "exports"),
  meta: join(HIVE_ROOT, "meta"),
  integrations: join(HIVE_ROOT, "integrations"),
  business: join(HIVE_ROOT, "business"),
  businessClients: join(HIVE_ROOT, "business", "clients"),
  businessInvoices: join(HIVE_ROOT, "business", "invoices"),
  businessContracts: join(HIVE_ROOT, "business", "contracts"),
  businessContractTemplates: join(HIVE_ROOT, "business", "contracts", "templates"),
  businessContractGenerated: join(HIVE_ROOT, "business", "contracts", "generated"),
  businessExpenses: join(HIVE_ROOT, "business", "expenses"),
  businessCompliance: join(HIVE_ROOT, "business", "compliance"),
  businessTax: join(HIVE_ROOT, "business", "tax"),
  marketing: join(HIVE_ROOT, "marketing"),
  marketingAnalytics: join(HIVE_ROOT, "marketing", "analytics"),
  marketplace: join(HIVE_ROOT, "marketplace"),
  marketplacePackages: join(HIVE_ROOT, "marketplace", "packages"),
  mesh: join(HIVE_ROOT, "mesh"),
  meshPeers: join(HIVE_ROOT, "mesh", "peers"),
  meshOutboundPatterns: join(HIVE_ROOT, "mesh", "shared", "outbound", "patterns"),
  meshOutboundAntiPatterns: join(HIVE_ROOT, "mesh", "shared", "outbound", "anti-patterns"),
  meshOutboundBenchmarks: join(HIVE_ROOT, "mesh", "shared", "outbound", "benchmarks"),
  meshInboundPatterns: join(HIVE_ROOT, "mesh", "shared", "inbound", "patterns"),
  meshInboundAntiPatterns: join(HIVE_ROOT, "mesh", "shared", "inbound", "anti-patterns"),
  meshInboundBenchmarks: join(HIVE_ROOT, "mesh", "shared", "inbound", "benchmarks"),
  meshDelegations: join(HIVE_ROOT, "mesh", "delegations"),
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
