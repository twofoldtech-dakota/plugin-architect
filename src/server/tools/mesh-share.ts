import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { HIVE_DIRS, readYaml, writeYaml, slugify } from "../storage/index.js";
import type { MeshIdentity, MeshSettings, SharedPattern, SharedAntiPattern, SharedBenchmark, ReputationEvent } from "../types/mesh.js";
import type { Pattern } from "../types/pattern.js";

// Privacy: fields that are NEVER shared
const SENSITIVE_FIELDS = ["source_code", "api_keys", "secrets", "client", "business", "personal"];

function generateMeshId(): string {
  return `mesh_${randomBytes(8).toString("hex")}`;
}

function randomizeTimestamp(date: string): string {
  // Randomize to same month for privacy
  const d = new Date(date);
  d.setDate(Math.floor(Math.random() * 28) + 1);
  d.setHours(Math.floor(Math.random() * 24));
  return d.toISOString();
}

function anonymizeText(text: string): string {
  // Strip potential project names, file paths, and personal references
  return text
    .replace(/\/[\w/.-]+/g, "[path]") // file paths
    .replace(/https?:\/\/[\w./-]+/g, "[url]") // URLs
    .replace(/@[\w.]+/g, "[email]") // emails
    .replace(/[A-Z][a-z]+(?:App|Server|Client|API|DB)/g, "[project]"); // common project name patterns
}

export function registerMeshShare(server: McpServer): void {
  server.tool(
    "hive_mesh_share",
    "Share knowledge to the Hive Mesh network. Shares pattern structure, anti-patterns, or stack benchmarks with anonymization. Source code is NEVER shared.",
    {
      type: z.enum(["pattern", "anti_pattern", "benchmark"]).describe("Type of knowledge to share"),
      source: z.string().describe("Slug of the source knowledge to share"),
      anonymize: z.boolean().optional().default(true).describe("Apply anonymization (default: true)"),
    },
    async ({ type, source, anonymize }) => {
      // Verify mesh connection
      let identity: MeshIdentity;
      try {
        identity = await readYaml<MeshIdentity>(join(HIVE_DIRS.mesh, "identity.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: "Not connected to mesh. Use hive_mesh_connect with action 'join' first." }],
          isError: true,
        };
      }

      if (identity.status !== "connected") {
        return {
          content: [{ type: "text" as const, text: "Mesh connection is disconnected. Reconnect first." }],
          isError: true,
        };
      }

      // Check sharing preferences
      let settings: MeshSettings;
      try {
        settings = await readYaml<MeshSettings>(join(HIVE_DIRS.mesh, "mesh-settings.yaml"));
      } catch {
        settings = { share_patterns: true, share_anti_patterns: true, share_benchmarks: true, accept_delegations: false, auto_merge_anti_patterns: false };
      }

      const meshId = generateMeshId();
      const now = new Date().toISOString();
      const sanitizationReport = { fields_removed: [] as string[], references_stripped: 0, code_excluded: true };

      if (type === "pattern") {
        if (!settings.share_patterns) {
          return {
            content: [{ type: "text" as const, text: "Pattern sharing is disabled in your mesh settings." }],
            isError: true,
          };
        }

        let pattern: Pattern;
        try {
          pattern = await readYaml<Pattern>(join(HIVE_DIRS.patterns, `${source}.yaml`));
        } catch {
          return {
            content: [{ type: "text" as const, text: `Pattern "${source}" not found.` }],
            isError: true,
          };
        }

        // Extract structural info only — NO source code
        const fileStructure = pattern.files.map((f) => f.path);
        const exports: string[] = [];
        for (const file of pattern.files) {
          // Extract export names from content without sharing the content itself
          const exportMatches = file.content.match(/export\s+(?:function|const|class|interface|type)\s+(\w+)/g);
          if (exportMatches) {
            exports.push(...exportMatches.map((m) => m.replace(/export\s+(?:function|const|class|interface|type)\s+/, "")));
          }
        }

        const shared: SharedPattern = {
          mesh_id: meshId,
          original_slug: anonymize ? "[redacted]" : source,
          name: pattern.name,
          description: anonymize ? anonymizeText(pattern.description) : pattern.description,
          tags: pattern.tags,
          stack: pattern.stack,
          file_structure: fileStructure,
          exports,
          shared_by: identity.peer_id,
          shared_at: anonymize ? randomizeTimestamp(now) : now,
          adoptions: 0,
          rating: 0,
        };

        // Strip used_in (project references)
        sanitizationReport.references_stripped = pattern.used_in?.length ?? 0;

        await writeYaml(join(HIVE_DIRS.meshOutboundPatterns, `${meshId}.yaml`), shared);

        // Update reputation
        await updateReputation(identity.peer_id, "Shared pattern to mesh", 5);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  shared_slug: source,
                  type: "pattern",
                  anonymized: anonymize,
                  sanitization_report: sanitizationReport,
                  mesh_id: meshId,
                  initial_visibility: "public",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (type === "anti_pattern") {
        if (!settings.share_anti_patterns) {
          return {
            content: [{ type: "text" as const, text: "Anti-pattern sharing is disabled in your mesh settings." }],
            isError: true,
          };
        }

        interface AntiPatternData {
          name: string;
          description: string;
          context: string;
          why_bad: string;
          instead: string;
          tags: string[];
          severity: "critical" | "warning" | "minor";
          learned_from?: string;
        }

        let antiPattern: AntiPatternData;
        try {
          antiPattern = await readYaml<AntiPatternData>(join(HIVE_DIRS.antipatterns, `${source}.yaml`));
        } catch {
          return {
            content: [{ type: "text" as const, text: `Anti-pattern "${source}" not found.` }],
            isError: true,
          };
        }

        const shared: SharedAntiPattern = {
          mesh_id: meshId,
          name: antiPattern.name,
          description: anonymize ? anonymizeText(antiPattern.description) : antiPattern.description,
          context: anonymize ? anonymizeText(antiPattern.context) : antiPattern.context,
          why_bad: anonymize ? anonymizeText(antiPattern.why_bad) : antiPattern.why_bad,
          instead: anonymize ? anonymizeText(antiPattern.instead) : antiPattern.instead,
          tags: antiPattern.tags,
          severity: antiPattern.severity,
          shared_by: identity.peer_id,
          shared_at: anonymize ? randomizeTimestamp(now) : now,
          reporters: 1,
        };

        // Strip learned_from (project reference)
        if (antiPattern.learned_from) {
          sanitizationReport.fields_removed.push("learned_from");
          sanitizationReport.references_stripped = 1;
        }

        await writeYaml(join(HIVE_DIRS.meshOutboundAntiPatterns, `${meshId}.yaml`), shared);
        await updateReputation(identity.peer_id, "Shared anti-pattern to mesh", 3);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  shared_slug: source,
                  type: "anti_pattern",
                  anonymized: anonymize,
                  sanitization_report: sanitizationReport,
                  mesh_id: meshId,
                  initial_visibility: "public",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (type === "benchmark") {
        if (!settings.share_benchmarks) {
          return {
            content: [{ type: "text" as const, text: "Benchmark sharing is disabled in your mesh settings." }],
            isError: true,
          };
        }

        // For benchmarks, source is a project slug — extract stack info anonymously
        let arch: { stack: Record<string, string>; components: Array<{ type: string }> };
        try {
          arch = await readYaml<typeof arch>(join(HIVE_DIRS.projects, source, "architecture.yaml"));
        } catch {
          return {
            content: [{ type: "text" as const, text: `Project "${source}" not found.` }],
            isError: true,
          };
        }

        const stackValues = Object.values(arch.stack).map((v) => v.toLowerCase());

        const shared: SharedBenchmark = {
          mesh_id: meshId,
          stack: stackValues,
          satisfaction: 3, // default neutral — user can adjust
          pain_points: [],
          praise: [],
          shared_by: identity.peer_id,
          shared_at: anonymize ? randomizeTimestamp(now) : now,
        };

        sanitizationReport.references_stripped = 1; // project name stripped

        await writeYaml(join(HIVE_DIRS.meshOutboundBenchmarks, `${meshId}.yaml`), shared);
        await updateReputation(identity.peer_id, "Shared stack benchmark to mesh", 2);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  shared_slug: source,
                  type: "benchmark",
                  anonymized: anonymize,
                  sanitization_report: sanitizationReport,
                  mesh_id: meshId,
                  initial_visibility: "public",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: `Unknown share type: ${type}` }],
        isError: true,
      };
    },
  );
}

async function updateReputation(peerId: string, event: string, change: number): Promise<void> {
  const reputationPath = join(HIVE_DIRS.mesh, "reputation.yaml");
  try {
    const rep = await readYaml<{
      peer_id: string;
      reputation_score: number;
      rank: string;
      history: ReputationEvent[];
      contributions: Record<string, number>;
    }>(reputationPath);

    rep.reputation_score += change;
    rep.history.push({
      date: new Date().toISOString(),
      event,
      reputation_change: change,
    });

    // Update rank based on score
    if (rep.reputation_score >= 100) rep.rank = "authority";
    else if (rep.reputation_score >= 50) rep.rank = "expert";
    else if (rep.reputation_score >= 10) rep.rank = "contributor";
    else rep.rank = "newcomer";

    await writeYaml(reputationPath, rep);
  } catch {
    // Reputation file not found — skip
  }
}
