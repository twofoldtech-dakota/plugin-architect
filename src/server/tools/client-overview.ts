import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { businessRepo } from "../storage/index.js";

export function registerClientOverview(server: McpServer): void {
  server.tool(
    "hive_client_overview",
    "Get an overview of all clients with billing status, active projects, and outstanding invoices.",
    {
      status: z
        .enum(["active", "inactive", "all"])
        .optional()
        .default("all")
        .describe("Filter by client status"),
    },
    async ({ status }) => {
      const allClients = businessRepo.listClients();

      if (allClients.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message: "No clients found.",
              setup: {
                message: "Clients can be created programmatically when generating invoices.",
              },
            }, null, 2),
          }],
        };
      }

      const allInvoices = businessRepo.listInvoices();
      const today = new Date().toISOString().split("T")[0];

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
      }> = [];

      for (const client of allClients) {
        if (status !== "all" && client.status !== status) continue;

        let outstanding = 0;
        let overdue = 0;
        let lastInvoiceDate: string | undefined;

        const clientInvoices = allInvoices.filter((inv) => inv.client_id === client.id);
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

        clients.push({
          slug: client.slug,
          name: client.name,
          status: client.status,
          active_projects: client.projects.length,
          total_invoiced: Math.round(client.billing.total_invoiced * 100) / 100,
          total_paid: Math.round(client.billing.total_paid * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          overdue: Math.round(overdue * 100) / 100,
          last_invoice: lastInvoiceDate,
        });
      }

      clients.sort((a, b) => b.outstanding - a.outstanding);

      const summary = {
        total_clients: clients.length,
        active: clients.filter((c) => c.status === "active").length,
        inactive: clients.filter((c) => c.status === "inactive").length,
        total_outstanding: Math.round(clients.reduce((sum, c) => sum + c.outstanding, 0) * 100) / 100,
        total_overdue: Math.round(clients.reduce((sum, c) => sum + c.overdue, 0) * 100) / 100,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ clients, summary }, null, 2) }],
      };
    },
  );
}
