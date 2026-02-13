import { randomUUID } from "node:crypto";
import { getDb, toJson, fromJson } from "../db.js";
import type { ClientProfile, ClientBilling, Invoice, InvoiceLineItem, ExpenseEntry, ExpenseCategory } from "../../types/business.js";

// ---- Revenue Entries ----

export interface RevenueEntry {
  id: string;
  project: string;
  date: string;
  amount: number;
  customers?: number;
  source?: string;
}

interface RevenueRow {
  id: string;
  project: string;
  date: string;
  amount: number;
  customers: number | null;
  source: string | null;
}

// ---- Backlog Items ----

export type BacklogItemType = "bug" | "improvement" | "idea" | "maintenance";
export type BacklogPriority = "critical" | "high" | "medium" | "low";
export type BacklogStatus = "open" | "in_progress" | "done" | "wont_fix";

export interface BacklogItem {
  id: string;
  project_id: string;
  type: BacklogItemType;
  title: string;
  description?: string;
  priority: BacklogPriority;
  status: BacklogStatus;
  source?: string;
  created: string;
  updated?: string;
}

interface BacklogRow {
  id: string;
  project_id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  source: string | null;
  created: string;
  updated: string | null;
}

// ---- Clients ----

interface ClientRow {
  id: string;
  slug: string;
  name: string;
  contact: string | null;
  billing: string;
  projects: string;
  contracts: string;
  status: string;
  created: string;
  updated: string | null;
}

// ---- Invoices ----

interface InvoiceRow {
  id: string;
  client_id: string;
  project: string | null;
  date: string;
  due_date: string | null;
  line_items: string;
  subtotal: number;
  tax: number;
  tax_rate: number | null;
  total: number;
  status: string;
  payment_link: string | null;
  notes: string | null;
  created: string;
  updated: string | null;
}

// ---- Expenses ----

interface ExpenseRow {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: string;
  project: string | null;
  recurring: number;
  note: string | null;
}

export const businessRepo = {
  // ---- Revenue ----
  addRevenue(entry: Omit<RevenueEntry, "id">): RevenueEntry {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO revenue_entries (id, project, date, amount, customers, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entry.project, entry.date, entry.amount, entry.customers ?? null, entry.source ?? null);
    return { ...entry, id };
  },

  listRevenue(project?: string, since?: string): RevenueEntry[] {
    const db = getDb();
    let rows: RevenueRow[];
    if (project && since) {
      rows = db.prepare("SELECT * FROM revenue_entries WHERE project = ? AND date >= ? ORDER BY date DESC").all(project, since) as RevenueRow[];
    } else if (project) {
      rows = db.prepare("SELECT * FROM revenue_entries WHERE project = ? ORDER BY date DESC").all(project) as RevenueRow[];
    } else if (since) {
      rows = db.prepare("SELECT * FROM revenue_entries WHERE date >= ? ORDER BY date DESC").all(since) as RevenueRow[];
    } else {
      rows = db.prepare("SELECT * FROM revenue_entries ORDER BY date DESC").all() as RevenueRow[];
    }
    return rows.map((r) => ({
      id: r.id,
      project: r.project,
      date: r.date,
      amount: r.amount,
      customers: r.customers ?? undefined,
      source: r.source ?? undefined,
    }));
  },

  // ---- Backlog ----
  addBacklogItem(projectId: string, item: Omit<BacklogItem, "id" | "project_id" | "created">): BacklogItem {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO backlog_items (id, project_id, type, title, description, priority, status, source, created)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, item.type, item.title, item.description ?? null, item.priority, item.status, item.source ?? null, now);
    return { id, project_id: projectId, ...item, created: now };
  },

  listBacklog(projectId: string, status?: string): BacklogItem[] {
    const db = getDb();
    let rows: BacklogRow[];
    if (status) {
      rows = db.prepare("SELECT * FROM backlog_items WHERE project_id = ? AND status = ? ORDER BY created DESC").all(projectId, status) as BacklogRow[];
    } else {
      rows = db.prepare("SELECT * FROM backlog_items WHERE project_id = ? ORDER BY created DESC").all(projectId) as BacklogRow[];
    }
    return rows.map((r) => ({
      id: r.id,
      project_id: r.project_id,
      type: r.type as BacklogItemType,
      title: r.title,
      description: r.description ?? undefined,
      priority: r.priority as BacklogPriority,
      status: r.status as BacklogStatus,
      source: r.source ?? undefined,
      created: r.created,
      updated: r.updated ?? undefined,
    }));
  },

  // ---- Clients ----
  createClient(client: Omit<ClientProfile, "id">): ClientProfile & { id: string } {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO clients (id, slug, name, contact, billing, projects, contracts, status, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, client.slug, client.name, client.contact ? toJson(client.contact) : null,
      toJson(client.billing), toJson(client.projects), toJson(client.contracts),
      client.status, client.created, client.updated ?? null,
    );
    return { ...client, id };
  },

  getClientBySlug(slug: string): (ClientProfile & { id: string }) | undefined {
    const db = getDb();
    const row = db.prepare("SELECT * FROM clients WHERE slug = ?").get(slug) as ClientRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      contact: fromJson<ClientProfile["contact"]>(row.contact) ?? undefined,
      billing: fromJson<ClientBilling>(row.billing) ?? { total_invoiced: 0, total_paid: 0 },
      projects: fromJson<string[]>(row.projects) ?? [],
      contracts: fromJson<string[]>(row.contracts) ?? [],
      status: row.status as ClientProfile["status"],
      created: row.created,
      updated: row.updated ?? undefined,
    };
  },

  listClients(): (ClientProfile & { id: string })[] {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM clients ORDER BY name").all() as ClientRow[];
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      contact: fromJson<ClientProfile["contact"]>(row.contact) ?? undefined,
      billing: fromJson<ClientBilling>(row.billing) ?? { total_invoiced: 0, total_paid: 0 },
      projects: fromJson<string[]>(row.projects) ?? [],
      contracts: fromJson<string[]>(row.contracts) ?? [],
      status: row.status as ClientProfile["status"],
      created: row.created,
      updated: row.updated ?? undefined,
    }));
  },

  updateClient(slug: string, updates: Partial<ClientProfile>): void {
    const db = getDb();
    const now = new Date().toISOString();
    const fields: string[] = ["updated = ?"];
    const values: unknown[] = [now];

    if (updates.billing !== undefined) { fields.push("billing = ?"); values.push(toJson(updates.billing)); }
    if (updates.projects !== undefined) { fields.push("projects = ?"); values.push(toJson(updates.projects)); }
    if (updates.contracts !== undefined) { fields.push("contracts = ?"); values.push(toJson(updates.contracts)); }
    if (updates.status !== undefined) { fields.push("status = ?"); values.push(updates.status); }

    values.push(slug);
    db.prepare(`UPDATE clients SET ${fields.join(", ")} WHERE slug = ?`).run(...values);
  },

  // ---- Invoices ----
  createInvoice(clientId: string, invoice: Omit<Invoice, "id" | "created">): Invoice & { id: string; client_id: string } {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO invoices (id, client_id, project, date, due_date, line_items, subtotal, tax, tax_rate, total, status, payment_link, notes, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, clientId, invoice.project ?? null, invoice.date, invoice.due_date ?? null,
      toJson(invoice.line_items), invoice.subtotal, invoice.tax, invoice.tax_rate ?? null,
      invoice.total, invoice.status, invoice.payment_link ?? null, invoice.notes ?? null,
      now, null,
    );
    return { ...invoice, id, client_id: clientId, created: now };
  },

  listInvoices(clientId?: string): (Invoice & { client_id: string })[] {
    const db = getDb();
    let rows: InvoiceRow[];
    if (clientId) {
      rows = db.prepare("SELECT * FROM invoices WHERE client_id = ? ORDER BY date DESC").all(clientId) as InvoiceRow[];
    } else {
      rows = db.prepare("SELECT * FROM invoices ORDER BY date DESC").all() as InvoiceRow[];
    }
    return rows.map((row) => ({
      id: row.id,
      client_id: row.client_id,
      client: row.client_id, // kept for compatibility
      project: row.project ?? undefined,
      date: row.date,
      due_date: row.due_date ?? undefined,
      line_items: fromJson<InvoiceLineItem[]>(row.line_items) ?? [],
      subtotal: row.subtotal,
      tax: row.tax,
      tax_rate: row.tax_rate ?? undefined,
      total: row.total,
      status: row.status as Invoice["status"],
      payment_link: row.payment_link ?? undefined,
      notes: row.notes ?? undefined,
      created: row.created,
      updated: row.updated ?? undefined,
    }));
  },

  // ---- Expenses ----
  addExpense(expense: Omit<ExpenseEntry, "id">): ExpenseEntry {
    const db = getDb();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO expenses (id, date, vendor, amount, category, project, recurring, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, expense.date, expense.vendor, expense.amount, expense.category, expense.project ?? null, expense.recurring ? 1 : 0, expense.note ?? null);
    return { ...expense, id };
  },

  listExpenses(since?: string, project?: string): ExpenseEntry[] {
    const db = getDb();
    let rows: ExpenseRow[];
    if (project && since) {
      rows = db.prepare("SELECT * FROM expenses WHERE project = ? AND date >= ? ORDER BY date DESC").all(project, since) as ExpenseRow[];
    } else if (project) {
      rows = db.prepare("SELECT * FROM expenses WHERE project = ? ORDER BY date DESC").all(project) as ExpenseRow[];
    } else if (since) {
      rows = db.prepare("SELECT * FROM expenses WHERE date >= ? ORDER BY date DESC").all(since) as ExpenseRow[];
    } else {
      rows = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all() as ExpenseRow[];
    }
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      vendor: r.vendor,
      amount: r.amount,
      category: r.category as ExpenseCategory,
      project: r.project ?? undefined,
      recurring: !!r.recurring,
      note: r.note ?? undefined,
    }));
  },
};
