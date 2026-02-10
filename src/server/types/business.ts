// ---- Business Entity ----

export interface BusinessEntity {
  name: string;
  type: string;
  state?: string;
  address?: string;
  payment_methods?: string[];
}

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

export interface InvoiceStore {
  invoices: Invoice[];
}

// ---- Contracts ----

export interface ContractTemplate {
  type: string;
  name: string;
  content: string;
  variables: string[];
}

export interface GeneratedContract {
  id: string;
  type: string;
  client?: string;
  project?: string;
  content: string;
  variables_used: Record<string, string>;
  review_notes: string[];
  status: "draft" | "sent" | "signed" | "expired";
  created: string;
}

export interface ContractStore {
  contracts: GeneratedContract[];
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

export interface MonthlyExpenses {
  month: string;
  entries: ExpenseEntry[];
  totals: {
    total: number;
    by_category: Record<string, number>;
  };
}

// ---- Compliance ----

export interface ComplianceIssue {
  project: string;
  category: string;
  severity: "critical" | "warning" | "info";
  description: string;
  fix: string;
  auto_fixable: boolean;
}

export interface ComplianceAudit {
  last_scan: string;
  scanned: number;
  issues: ComplianceIssue[];
  compliant: string[];
}

// ---- Tax ----

export interface TaxSummary {
  year: number;
  total_revenue: number;
  total_expenses: number;
  deductible_expenses: number;
  taxable_income: number;
  estimated_liability: number;
  quarterly_payments: number[];
  notes: string[];
}
