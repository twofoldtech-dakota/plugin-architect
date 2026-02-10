import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { HIVE_DIRS, readYaml, writeYaml, safeName } from "../storage/index.js";
import type { MeshIdentity, MeshPeer, MeshDelegation } from "../types/mesh.js";

function generateDelegationId(): string {
  return `del_${randomBytes(8).toString("hex")}`;
}

export function registerMeshDelegate(server: McpServer): void {
  server.tool(
    "hive_mesh_delegate",
    "Delegate a task to a mesh peer via A2A protocol. Searches for peers with matching specialties and reputation.",
    {
      description: z.string().describe("Description of the task to delegate"),
      required_specialties: z.array(z.string()).describe("Required specialties for the peer"),
      budget_tokens: z.number().optional().describe("Maximum token budget for the delegation"),
      deadline: z.string().optional().describe("Deadline for completion (ISO 8601)"),
      prefer_peer: z.string().optional().describe("Preferred peer_id to assign to"),
    },
    async ({ description, required_specialties, budget_tokens, deadline, prefer_peer }) => {
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
          content: [{ type: "text" as const, text: "Mesh is disconnected. Reconnect first." }],
          isError: true,
        };
      }

      // Find matching peers
      let peerFiles: string[];
      try {
        peerFiles = await readdir(HIVE_DIRS.meshPeers);
      } catch {
        peerFiles = [];
      }

      const candidates: MeshPeer[] = [];
      for (const f of peerFiles) {
        if (!f.endsWith(".yaml")) continue;
        try {
          const peer = await readYaml<MeshPeer>(join(HIVE_DIRS.meshPeers, f));
          // Check if peer has required specialties
          const lowerRequired = required_specialties.map((s) => s.toLowerCase());
          const matchCount = peer.specialties.filter((s) => lowerRequired.includes(s.toLowerCase())).length;
          if (matchCount > 0) {
            candidates.push(peer);
          }
        } catch {
          continue;
        }
      }

      // Sort by reputation and specialty match
      candidates.sort((a, b) => {
        const lowerRequired = required_specialties.map((s) => s.toLowerCase());
        const aMatch = a.specialties.filter((s) => lowerRequired.includes(s.toLowerCase())).length;
        const bMatch = b.specialties.filter((s) => lowerRequired.includes(s.toLowerCase())).length;
        if (bMatch !== aMatch) return bMatch - aMatch;
        return b.reputation_score - a.reputation_score;
      });

      const now = new Date().toISOString();
      const delegationId = generateDelegationId();

      // Determine assignment
      let assignedPeer: MeshPeer | undefined;

      if (prefer_peer) {
        assignedPeer = candidates.find((p) => p.peer_id === prefer_peer);
        if (!assignedPeer) {
          // Try to load preferred peer directly
          try {
            const preferred = await readYaml<MeshPeer>(join(HIVE_DIRS.meshPeers, `${safeName(prefer_peer)}.yaml`));
            assignedPeer = preferred;
          } catch {
            // Preferred peer not found — fall through to best match
          }
        }
      }

      if (!assignedPeer && candidates.length > 0) {
        assignedPeer = candidates[0];
      }

      const delegation: MeshDelegation = {
        id: delegationId,
        description,
        required_specialties,
        budget_tokens,
        deadline,
        prefer_peer,
        status: assignedPeer ? "assigned" : "searching",
        assigned_to: assignedPeer
          ? {
              peer_id: assignedPeer.peer_id,
              display_name: assignedPeer.display_name,
              reputation: assignedPeer.reputation_score,
              specialties: assignedPeer.specialties,
            }
          : undefined,
        created: now,
        updated: now,
      };

      await writeYaml(join(HIVE_DIRS.meshDelegations, `${delegationId}.yaml`), delegation);

      // Build alternatives list (top 3 other candidates)
      const alternatives = candidates
        .filter((p) => p.peer_id !== assignedPeer?.peer_id)
        .slice(0, 3)
        .map((p) => ({
          peer_id: p.peer_id,
          display_name: p.display_name,
          reputation: p.reputation_score,
          specialties: p.specialties,
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                delegation_id: delegationId,
                status: delegation.status,
                assigned_to: delegation.assigned_to ?? null,
                alternatives,
                description: description.slice(0, 120),
                required_specialties,
                budget_tokens: budget_tokens ?? null,
                deadline: deadline ?? null,
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
