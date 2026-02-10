import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { MeshIdentity, MeshSettings, MeshPeer } from "../types/mesh.js";
import type { Architecture } from "../types/architecture.js";

function generatePeerId(): string {
  return `peer_${randomBytes(16).toString("hex")}`;
}

function generateKeyPair(): { publicKey: string; privateKey: string } {
  return {
    publicKey: `pub_${randomBytes(32).toString("hex")}`,
    privateKey: `prv_${randomBytes(32).toString("hex")}`,
  };
}

async function detectSpecialties(): Promise<string[]> {
  const specialties = new Set<string>();
  let projectDirs: string[];
  try {
    projectDirs = await readdir(HIVE_DIRS.projects);
  } catch {
    return [];
  }

  for (const dir of projectDirs) {
    try {
      const arch = await readYaml<Architecture>(join(HIVE_DIRS.projects, dir, "architecture.yaml"));
      for (const val of Object.values(arch.stack)) {
        specialties.add(val.toLowerCase());
      }
      for (const comp of arch.components) {
        specialties.add(comp.type.toLowerCase());
      }
    } catch {
      continue;
    }
  }

  return [...specialties].slice(0, 20);
}

export function registerMeshConnect(server: McpServer): void {
  server.tool(
    "hive_mesh_connect",
    "Connect to the Hive Mesh peer-to-peer knowledge network. Join, update profile, check status, or disconnect.",
    {
      action: z.enum(["join", "update_profile", "status", "disconnect"]).describe("Action to perform"),
      display_name: z.string().optional().describe("Your display name on the mesh"),
      share_preferences: z.object({
        share_patterns: z.boolean().optional(),
        share_anti_patterns: z.boolean().optional(),
        share_benchmarks: z.boolean().optional(),
        accept_delegations: z.boolean().optional(),
        auto_merge_anti_patterns: z.boolean().optional(),
      }).optional().describe("Sharing preferences for the mesh"),
    },
    async ({ action, display_name, share_preferences }) => {
      const identityPath = join(HIVE_DIRS.mesh, "identity.yaml");
      const settingsPath = join(HIVE_DIRS.mesh, "mesh-settings.yaml");
      const reputationPath = join(HIVE_DIRS.mesh, "reputation.yaml");

      if (action === "join") {
        // Check if already joined
        try {
          const existing = await readYaml<MeshIdentity>(identityPath);
          if (existing.status === "connected") {
            return {
              content: [{ type: "text" as const, text: `Already connected to mesh as "${existing.display_name}" (${existing.peer_id}).` }],
              isError: true,
            };
          }
        } catch {
          // Not joined yet — proceed
        }

        const keyPair = generateKeyPair();
        const peerId = generatePeerId();
        const specialties = await detectSpecialties();
        const now = new Date().toISOString();

        const identity: MeshIdentity = {
          peer_id: peerId,
          display_name: display_name ?? "Anonymous Hive",
          public_key: keyPair.publicKey,
          specialties,
          reputation_score: 0,
          joined: now,
          status: "connected",
        };

        const settings: MeshSettings = {
          share_patterns: share_preferences?.share_patterns ?? true,
          share_anti_patterns: share_preferences?.share_anti_patterns ?? true,
          share_benchmarks: share_preferences?.share_benchmarks ?? true,
          accept_delegations: share_preferences?.accept_delegations ?? false,
          auto_merge_anti_patterns: share_preferences?.auto_merge_anti_patterns ?? false,
        };

        const reputation = {
          peer_id: peerId,
          display_name: identity.display_name,
          reputation_score: 0,
          rank: "newcomer",
          specialties,
          contributions: {
            patterns_shared: 0,
            adoptions_of_your_patterns: 0,
            anti_patterns_contributed: 0,
            delegations_completed: 0,
            delegations_failed: 0,
            average_rating_received: 0,
          },
          history: [{ date: now, event: "Joined Hive Mesh", reputation_change: 0 }],
        };

        // Write private key separately (never shared)
        await writeYaml(join(HIVE_DIRS.mesh, "private-key.yaml"), { private_key: keyPair.privateKey });
        await writeYaml(identityPath, identity);
        await writeYaml(settingsPath, settings);
        await writeYaml(reputationPath, reputation);

        // Count existing peers
        let peerCount = 0;
        try {
          const peers = await readdir(HIVE_DIRS.meshPeers);
          peerCount = peers.filter((f) => f.endsWith(".yaml")).length;
        } catch {
          // No peers yet
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  peer_id: peerId,
                  status: "connected",
                  peers_discovered: peerCount,
                  your_reputation: 0,
                  specialties_detected: specialties,
                  settings,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (action === "update_profile") {
        let identity: MeshIdentity;
        try {
          identity = await readYaml<MeshIdentity>(identityPath);
        } catch {
          return {
            content: [{ type: "text" as const, text: "Not connected to mesh. Use action 'join' first." }],
            isError: true,
          };
        }

        if (display_name) {
          identity.display_name = display_name;
        }

        // Re-detect specialties
        identity.specialties = await detectSpecialties();
        await writeYaml(identityPath, identity);

        if (share_preferences) {
          let settings: MeshSettings;
          try {
            settings = await readYaml<MeshSettings>(settingsPath);
          } catch {
            settings = {
              share_patterns: true,
              share_anti_patterns: true,
              share_benchmarks: true,
              accept_delegations: false,
              auto_merge_anti_patterns: false,
            };
          }

          if (share_preferences.share_patterns !== undefined) settings.share_patterns = share_preferences.share_patterns;
          if (share_preferences.share_anti_patterns !== undefined) settings.share_anti_patterns = share_preferences.share_anti_patterns;
          if (share_preferences.share_benchmarks !== undefined) settings.share_benchmarks = share_preferences.share_benchmarks;
          if (share_preferences.accept_delegations !== undefined) settings.accept_delegations = share_preferences.accept_delegations;
          if (share_preferences.auto_merge_anti_patterns !== undefined) settings.auto_merge_anti_patterns = share_preferences.auto_merge_anti_patterns;

          await writeYaml(settingsPath, settings);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "Profile updated",
                  peer_id: identity.peer_id,
                  display_name: identity.display_name,
                  specialties: identity.specialties,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (action === "status") {
        let identity: MeshIdentity;
        try {
          identity = await readYaml<MeshIdentity>(identityPath);
        } catch {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ status: "not_connected", message: "Use action 'join' to connect." }, null, 2) }],
          };
        }

        let settings: MeshSettings | undefined;
        try {
          settings = await readYaml<MeshSettings>(settingsPath);
        } catch {
          // no settings
        }

        let peerCount = 0;
        try {
          const peers = await readdir(HIVE_DIRS.meshPeers);
          peerCount = peers.filter((f) => f.endsWith(".yaml")).length;
        } catch {
          // no peers
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  peer_id: identity.peer_id,
                  status: identity.status,
                  display_name: identity.display_name,
                  peers_discovered: peerCount,
                  your_reputation: identity.reputation_score,
                  specialties: identity.specialties,
                  settings,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (action === "disconnect") {
        let identity: MeshIdentity;
        try {
          identity = await readYaml<MeshIdentity>(identityPath);
        } catch {
          return {
            content: [{ type: "text" as const, text: "Not connected to mesh." }],
            isError: true,
          };
        }

        identity.status = "disconnected";
        await writeYaml(identityPath, identity);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ message: "Disconnected from Hive Mesh", peer_id: identity.peer_id, status: "disconnected" }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: `Unknown action: ${action}` }],
        isError: true,
      };
    },
  );
}
