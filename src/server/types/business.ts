// ---- Clients ----

export interface ClientBilling {
  rate?: number;
  rate_type?: "hourly" | "project" | "retainer";
  terms?: string;
  currency?: string;
  total_invoiced: number;
  total_paid: number;
}

export interface ClientProfile {
  id?: string;
  slug: string;
  name: string;
  contact?: {
    email?: string;
    phone?: string;
    company?: string;
  };
  billing: ClientBilling;
  projects: string[];
  contracts: string[];
  status: "active" | "inactive";
  created: string;
  updated?: string;
}

// ---- Invoices ----

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  client: string;
  client_id?: string;
  project?: string;
  date: string;
  due_date?: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  tax_rate?: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  payment_link?: string;
  notes?: string;
  created: string;
  updated?: string;
}

// ---- Expenses ----

export type ExpenseCategory =
  | "hosting"
  | "apis"
  | "domains"
  | "tools"
  | "hardware"
  | "travel"
  | "other";

export interface ExpenseEntry {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: ExpenseCategory;
  project?: string;
  recurring?: boolean;
  note?: string;
}
