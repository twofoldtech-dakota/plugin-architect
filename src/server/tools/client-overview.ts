import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { HIVE_DIRS, readYaml } from "../storage/index.js";
import type { ClientProfile, InvoiceStore } from "../types/business.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerClientOverview(server: McpServer): void {
  server.tool(
    "hive_client_overview",
    "Get an overview of all clients with billing status, active projects, outstanding invoices, and contract status.",
    {
      status: z
        .enum(["active", "inactive", "all"])
        .optional()
        .default("all")
        .describe("Filter by client status"),
    },
    async ({ status }) => {
      let clientFiles: string[];
      try {
        clientFiles = (await readdir(HIVE_DIRS.businessClients)).filter((f) => f.endsWith(".yaml"));
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  message: "No clients found.",
                  setup: {
                    message: "Create client profiles in ~/.hive/business/clients/",
                    example: {
                      slug: "acme-corp",
                      name: "Acme Corporation",
                      contact: { email: "billing@acme.com", company: "Acme Corp" },
                      billing: { rate: 150, rate_type: "hourly", terms: "net-30", currency: "USD", total_invoiced: 0, total_paid: 0 },
                      projects: ["project-alpha"],
                      contracts: [],
                      status: "active",
                      created: new Date().toISOString().split("T")[0],
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Load invoice store for cross-referencing
      const storePath = join(HIVE_DIRS.businessInvoices, "store.yaml");
      const invoiceStore = await safeRead<InvoiceStore>(storePath);
      const today = new Date().toISOString().split("T")[0];

      // Load contract store
      const contractStorePath = join(HIVE_DIRS.businessContractGenerated, "store.yaml");
      const contractStore = await safeRead<{ contracts: Array<{ client?: string; status: string }> }>(contractStorePath);

      const clients: Array<{
        slug: string;
        name: string;
        status: string;
        active_projects: number;
        total_invoiced: number;
        total_paid: number;
        outstanding: number;
        overdue: number;
        last_invoice?: string;
        contract_status: string;
      }> = [];

      for (const file of clientFiles) {
        const slug = file.replace(".yaml", "");
        const client = await safeRead<ClientProfile>(join(HIVE_DIRS.businessClients, file));
        if (!client) continue;

        // Apply status filter
        if (status !== "all" && client.status !== status) continue;

        // Compute invoice stats for this client
        let outstanding = 0;
        let overdue = 0;
        let lastInvoiceDate: string | undefined;

        if (invoiceStore) {
          const clientInvoices = invoiceStore.invoices.filter((inv) => inv.client === slug);
          for (const inv of clientInvoices) {
            if (inv.status === "sent" || inv.status === "overdue") {
              outstanding += inv.total;
              if (inv.due_date && inv.due_date < today) {
                overdue += inv.total;
              }
            }
            if (!lastInvoiceDate || inv.date > lastInvoiceDate) {
              lastInvoiceDate = inv.date;
            }
          }
        }

        // Contract status
        let contractStatus = "none";
        if (contractStore) {
          const clientContracts = contractStore.contracts.filter((c) => c.client === slug);
          if (clientContracts.length > 0) {
            const hasSigned = clientContracts.some((c) => c.status === "signed");
            const hasDraft = clientContracts.some((c) => c.status === "draft");
            contractStatus = hasSigned ? "signed" : hasDraft ? "draft" : "sent";
          }
        }

        clients.push({
          slug,
          name: client.name,
          status: client.status,
          active_projects: client.projects.length,
          total_invoiced: Math.round(client.billing.total_invoiced * 100) / 100,
          total_paid: Math.round(client.billing.total_paid * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          overdue: Math.round(overdue * 100) / 100,
          last_invoice: lastInvoiceDate,
          contract_status: contractStatus,
        });
      }

      // Sort by outstanding (highest first)
      clients.sort((a, b) => b.outstanding - a.outstanding);

      // Summary
      const summary = {
        total_clients: clients.length,
        active: clients.filter((c) => c.status === "active").length,
        inactive: clients.filter((c) => c.status === "inactive").length,
        total_outstanding: Math.round(clients.reduce((sum, c) => sum + c.outstanding, 0) * 100) / 100,
        total_overdue: Math.round(clients.reduce((sum, c) => sum + c.overdue, 0) * 100) / 100,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ clients, summary }, null, 2),
          },
        ],
      };
    },
  );
}
