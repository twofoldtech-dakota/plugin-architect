import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { ClientProfile, Invoice, InvoiceLineItem, InvoiceStore } from "../types/business.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

export function registerGenerateInvoice(server: McpServer): void {
  server.tool(
    "hive_generate_invoice",
    "Generate an invoice for a client. Auto-fills from client profile and billing terms. Supports line items or auto-generation from project deliverables.",
    {
      client: z.string().describe("Client slug"),
      project: z.string().optional().describe("Project slug (for context)"),
      line_items: z
        .array(
          z.object({
            description: z.string().describe("Line item description"),
            quantity: z.number().describe("Quantity"),
            rate: z.number().describe("Rate per unit"),
          }),
        )
        .optional()
        .describe("Invoice line items. If omitted, auto-generates from client billing rate."),
      period: z
        .enum(["this_month", "last_month"])
        .optional()
        .default("this_month")
        .describe("Billing period"),
    },
    async ({ client, project, line_items, period }) => {
      // Read client profile
      const clientPath = join(HIVE_DIRS.businessClients, `${client}.yaml`);
      const clientProfile = await safeRead<ClientProfile>(clientPath);

      if (!clientProfile) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `Client "${client}" not found.`,
                  setup: {
                    message: `Create a client profile at ~/.hive/business/clients/${client}.yaml`,
                    example: {
                      slug: client,
                      name: "Client Name",
                      contact: { email: "client@example.com" },
                      billing: { rate: 150, rate_type: "hourly", terms: "net-30", currency: "USD", total_invoiced: 0, total_paid: 0 },
                      projects: [],
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
          isError: true,
        };
      }

      // Build line items
      let items: InvoiceLineItem[];

      if (line_items && line_items.length > 0) {
        items = line_items.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          rate: li.rate,
          amount: Math.round(li.quantity * li.rate * 100) / 100,
        }));
      } else {
        // Auto-generate from client billing rate
        const rate = clientProfile.billing.rate ?? 150;
        const rateType = clientProfile.billing.rate_type ?? "hourly";
        const now = new Date();
        const monthName =
          period === "last_month"
            ? new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("default", { month: "long", year: "numeric" })
            : now.toLocaleString("default", { month: "long", year: "numeric" });

        items = [
          {
            description: `${rateType === "hourly" ? "Development services" : rateType === "retainer" ? "Monthly retainer" : "Project deliverable"} — ${monthName}${project ? ` (${project})` : ""}`,
            quantity: rateType === "hourly" ? 40 : 1,
            rate,
            amount: Math.round((rateType === "hourly" ? 40 : 1) * rate * 100) / 100,
          },
        ];
      }

      const subtotal = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
      const taxRate = 0; // Default no tax — can be customized
      const tax = Math.round(subtotal * taxRate * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      // Read or create invoice store
      const storePath = join(HIVE_DIRS.businessInvoices, "store.yaml");
      let store: InvoiceStore;
      try {
        store = await readYaml<InvoiceStore>(storePath);
      } catch {
        store = { invoices: [] };
      }

      // Generate invoice ID
      const year = new Date().getFullYear();
      const yearInvoices = store.invoices.filter((inv) => inv.id.startsWith(`INV-${year}-`));
      const seq = yearInvoices.length + 1;
      const invoiceId = `INV-${year}-${String(seq).padStart(3, "0")}`;

      const now = new Date().toISOString().split("T")[0];

      // Calculate due date from terms
      let dueDate: string | undefined;
      const terms = clientProfile.billing.terms;
      if (terms) {
        const netMatch = terms.match(/net[- ]?(\d+)/i);
        if (netMatch) {
          const days = parseInt(netMatch[1], 10);
          const due = new Date();
          due.setDate(due.getDate() + days);
          dueDate = due.toISOString().split("T")[0];
        }
      }

      const invoice: Invoice = {
        id: invoiceId,
        client,
        project,
        date: now,
        due_date: dueDate,
        line_items: items,
        subtotal,
        tax,
        tax_rate: taxRate,
        total,
        status: "draft",
        created: now,
      };

      store.invoices.push(invoice);
      await writeYaml(storePath, store);

      // Update client total invoiced
      clientProfile.billing.total_invoiced = Math.round((clientProfile.billing.total_invoiced + total) * 100) / 100;
      clientProfile.updated = now;
      await writeYaml(clientPath, clientProfile);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Invoice ${invoiceId} created`,
                invoice,
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
