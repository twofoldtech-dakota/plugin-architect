import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { MeshIdentity, MeshPeer, MeshReputation, ReputationRank } from "../types/mesh.js";

function computeRank(score: number): ReputationRank {
  if (score >= 100) return "authority";
  if (score >= 50) return "expert";
  if (score >= 10) return "contributor";
  return "newcomer";
}

export function registerMeshReputation(server: McpServer): void {
  server.tool(
    "hive_mesh_reputation",
    "View reputation profile for yourself or a mesh peer. Shows reputation score, rank, contributions, and history.",
    {
      peer_id: z.string().optional().describe("Peer ID to view (default: self)"),
    },
    async ({ peer_id }) => {
      // Determine if viewing self or another peer
      let identity: MeshIdentity;
      try {
        identity = await readYaml<MeshIdentity>(join(HIVE_DIRS.mesh, "identity.yaml"));
      } catch {
        return {
          content: [{ type: "text" as const, text: "Not connected to mesh. Use hive_mesh_connect with action 'join' first." }],
          isError: true,
        };
      }

      const isSelf = !peer_id || peer_id === identity.peer_id;

      if (isSelf) {
        // Return own reputation
        let reputation: MeshReputation;
        try {
          reputation = await readYaml<MeshReputation>(join(HIVE_DIRS.mesh, "reputation.yaml"));
        } catch {
          // No reputation file — return defaults
          reputation = {
            peer_id: identity.peer_id,
            display_name: identity.display_name,
            reputation_score: 0,
            rank: "newcomer",
            specialties: identity.specialties,
            contributions: {
              patterns_shared: 0,
              adoptions_of_your_patterns: 0,
              anti_patterns_contributed: 0,
              delegations_completed: 0,
              delegations_failed: 0,
              average_rating_received: 0,
            },
            history: [],
          };
        }

        // Compute live contributions from outbound shares
        let patternsShared = 0;
        let antiPatternsShared = 0;
        try {
          const outPatterns = await readdir(HIVE_DIRS.meshOutboundPatterns);
          patternsShared = outPatterns.filter((f) => f.endsWith(".yaml")).length;
        } catch { /* empty */ }
        try {
          const outAntiPatterns = await readdir(HIVE_DIRS.meshOutboundAntiPatterns);
          antiPatternsShared = outAntiPatterns.filter((f) => f.endsWith(".yaml")).length;
        } catch { /* empty */ }

        // Count delegations
        let delegationsCompleted = 0;
        let delegationsFailed = 0;
        try {
          const delegationFiles = await readdir(HIVE_DIRS.meshDelegations);
          for (const f of delegationFiles) {
            if (!f.endsWith(".yaml")) continue;
            try {
              const del = await readYaml<{ status: string }>(join(HIVE_DIRS.meshDelegations, f));
              if (del.status === "completed") delegationsCompleted++;
              if (del.status === "failed") delegationsFailed++;
            } catch {
              continue;
            }
          }
        } catch { /* empty */ }

        reputation.contributions.patterns_shared = patternsShared;
        reputation.contributions.anti_patterns_contributed = antiPatternsShared;
        reputation.contributions.delegations_completed = delegationsCompleted;
        reputation.contributions.delegations_failed = delegationsFailed;
        reputation.rank = computeRank(reputation.reputation_score);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(reputation, null, 2),
            },
          ],
        };
      }

      // Viewing another peer
      let peer: MeshPeer;
      try {
        peer = await readYaml<MeshPeer>(join(HIVE_DIRS.meshPeers, `${peer_id}.yaml`));
      } catch {
        return {
          content: [{ type: "text" as const, text: `Peer "${peer_id}" not found in known peers.` }],
          isError: true,
        };
      }

      const peerReputation: MeshReputation = {
        peer_id: peer.peer_id,
        display_name: peer.display_name,
        reputation_score: peer.reputation_score,
        rank: computeRank(peer.reputation_score),
        specialties: peer.specialties,
        contributions: {
          patterns_shared: peer.patterns_exchanged,
          adoptions_of_your_patterns: 0, // unknown for remote peers
          anti_patterns_contributed: 0, // unknown for remote peers
          delegations_completed: 0,
          delegations_failed: 0,
          average_rating_received: 0,
        },
        history: [], // not shared for privacy
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(peerReputation, null, 2),
          },
        ],
      };
    },
  );
}
