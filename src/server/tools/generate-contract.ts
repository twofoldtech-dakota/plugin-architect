import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { HIVE_DIRS, readYaml, writeYaml } from "../storage/index.js";
import type { BusinessEntity, ClientProfile, ContractStore, GeneratedContract } from "../types/business.js";
import type { Architecture } from "../types/architecture.js";

async function safeRead<T>(path: string): Promise<T | null> {
  try {
    return await readYaml<T>(path);
  } catch {
    return null;
  }
}

const DEFAULT_TEMPLATES: Record<string, { name: string; content: string; variables: string[] }> = {
  freelance: {
    name: "Freelance Services Agreement",
    content: `FREELANCE SERVICES AGREEMENT

This Agreement is entered into as of {{date}} between:

Provider: {{business_name}} ("Provider")
Client: {{client_name}} ("Client")

1. SERVICES
Provider agrees to perform the following services: {{project_description}}

2. COMPENSATION
Client agrees to pay Provider at a rate of {{rate}} {{rate_type}}.
Payment terms: {{payment_terms}}

3. TERM
This agreement begins on {{start_date}} and continues until the project is completed or terminated by either party with 14 days written notice.

4. INTELLECTUAL PROPERTY
All work product created under this agreement shall be owned by Client upon full payment.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of proprietary information shared during the engagement.

6. LIMITATION OF LIABILITY
Provider's total liability shall not exceed the total fees paid under this agreement.

7. GOVERNING LAW
This agreement shall be governed by the laws of {{state}}.

Provider: {{business_name}}
Client: {{client_name}}
Date: {{date}}`,
    variables: ["date", "business_name", "client_name", "project_description", "rate", "rate_type", "payment_terms", "start_date", "state"],
  },
  saas_terms: {
    name: "SaaS Terms of Service",
    content: `TERMS OF SERVICE — {{product_name}}

Last updated: {{date}}

1. ACCEPTANCE OF TERMS
By accessing or using {{product_name}} ("Service"), you agree to these Terms of Service.

2. DESCRIPTION OF SERVICE
{{product_description}}

3. ACCOUNTS
You are responsible for maintaining the security of your account credentials.

4. PAYMENT
{{pricing_terms}}

5. CANCELLATION AND REFUNDS
You may cancel your subscription at any time. Refunds are provided on a pro-rata basis for unused service periods.

6. DATA AND PRIVACY
Your data is yours. We process it only to provide the Service. See our Privacy Policy for details.

7. SERVICE AVAILABILITY
We aim for 99.9% uptime but do not guarantee uninterrupted service.

8. LIMITATION OF LIABILITY
Our total liability is limited to fees paid in the 12 months preceding the claim.

9. CHANGES TO TERMS
We may update these terms with 30 days notice via email or in-app notification.

10. CONTACT
{{business_name}}
{{contact_email}}`,
    variables: ["date", "product_name", "product_description", "pricing_terms", "business_name", "contact_email"],
  },
  privacy_policy: {
    name: "Privacy Policy",
    content: `PRIVACY POLICY — {{product_name}}

Last updated: {{date}}

1. INFORMATION WE COLLECT
- Account information (email, name)
- Usage data (features used, session duration)
- Payment information (processed by third-party providers)

2. HOW WE USE INFORMATION
- To provide and improve the Service
- To communicate with you about your account
- To comply with legal obligations

3. DATA SHARING
We do not sell your personal data. We share data only with:
- Service providers who help us operate (hosting, payment processing)
- When required by law

4. DATA RETENTION
We retain your data while your account is active. Upon deletion request, we remove data within 30 days.

5. YOUR RIGHTS
You have the right to: access, correct, delete, and export your data.

6. SECURITY
We use industry-standard encryption and security practices.

7. CONTACT
{{business_name}}
{{contact_email}}

8. CHANGES
We will notify you of material changes via email.`,
    variables: ["date", "product_name", "business_name", "contact_email"],
  },
  terms_of_service: {
    name: "Terms of Service",
    content: `TERMS OF SERVICE

Last updated: {{date}}

{{business_name}} ("we", "us", "our") operates {{product_name}}.

1. AGREEMENT
By using our service, you agree to these terms.

2. USE LICENSE
We grant you a limited, non-exclusive license to use the service for its intended purpose.

3. PROHIBITED USES
You may not: reverse engineer the service, use it for illegal purposes, or attempt to gain unauthorized access.

4. PAYMENT
{{pricing_terms}}

5. TERMINATION
We may terminate access for violation of these terms.

6. DISCLAIMER
The service is provided "as is" without warranty.

7. CONTACT
{{business_name}}
{{contact_email}}`,
    variables: ["date", "product_name", "pricing_terms", "business_name", "contact_email"],
  },
  nda: {
    name: "Non-Disclosure Agreement",
    content: `MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is entered into as of {{date}} between:

Party A: {{business_name}}
Party B: {{client_name}}

1. DEFINITION
"Confidential Information" means any non-public information disclosed by either party, including but not limited to: business plans, code, designs, financial data, and customer information.

2. OBLIGATIONS
Each party agrees to:
- Hold Confidential Information in strict confidence
- Not disclose to third parties without prior written consent
- Use information only for the purpose of evaluating a potential business relationship

3. EXCLUSIONS
This agreement does not apply to information that is: publicly available, independently developed, or received from a third party without restriction.

4. TERM
This agreement remains in effect for 2 years from the date above.

5. GOVERNING LAW
Governed by the laws of {{state}}.

Party A: {{business_name}}
Party B: {{client_name}}
Date: {{date}}`,
    variables: ["date", "business_name", "client_name", "state"],
  },
};

export function registerGenerateContract(server: McpServer): void {
  server.tool(
    "hive_generate_contract",
    "Generate a contract from templates. Auto-fills variables from business entity, client profile, and project context.",
    {
      type: z
        .enum(["freelance", "saas_terms", "privacy_policy", "terms_of_service", "nda"])
        .describe("Contract type"),
      client: z.string().optional().describe("Client slug (for freelance/NDA contracts)"),
      project: z.string().optional().describe("Project slug (for context)"),
      customizations: z
        .record(z.string(), z.string())
        .optional()
        .describe("Custom variable overrides (e.g., { rate: '$200/hr' })"),
    },
    async ({ type, client, project, customizations }) => {
      // Try to load custom template first, fall back to default
      const templatePath = join(HIVE_DIRS.businessContractTemplates, `${type}.yaml`);
      let template = await safeRead<{ name: string; content: string; variables: string[] }>(templatePath);
      if (!template) {
        template = DEFAULT_TEMPLATES[type];
      }
      if (!template) {
        return {
          content: [{ type: "text" as const, text: `Unknown contract type: "${type}"` }],
          isError: true,
        };
      }

      // Gather variables from context
      const variables: Record<string, string> = {};
      const now = new Date().toISOString().split("T")[0];
      variables["date"] = now;
      variables["start_date"] = now;

      // Business entity
      const entityPath = join(HIVE_DIRS.business, "entity.yaml");
      const entity = await safeRead<BusinessEntity>(entityPath);
      if (entity) {
        variables["business_name"] = entity.name;
        variables["state"] = entity.state ?? "Delaware";
        variables["contact_email"] = "contact@example.com";
      } else {
        variables["business_name"] = "[YOUR BUSINESS NAME]";
        variables["state"] = "[STATE]";
        variables["contact_email"] = "[EMAIL]";
      }

      // Client profile
      if (client) {
        const clientPath = join(HIVE_DIRS.businessClients, `${client}.yaml`);
        const clientProfile = await safeRead<ClientProfile>(clientPath);
        if (clientProfile) {
          variables["client_name"] = clientProfile.name;
          if (clientProfile.billing.rate) {
            variables["rate"] = `$${clientProfile.billing.rate}`;
            variables["rate_type"] = clientProfile.billing.rate_type ?? "per hour";
          }
          variables["payment_terms"] = clientProfile.billing.terms ?? "Net 30";
        } else {
          variables["client_name"] = "[CLIENT NAME]";
        }
      } else {
        variables["client_name"] = "[CLIENT NAME]";
      }

      // Project context
      if (project) {
        const archPath = join(HIVE_DIRS.projects, project, "architecture.yaml");
        const arch = await safeRead<Architecture>(archPath);
        if (arch) {
          variables["product_name"] = arch.project;
          variables["product_description"] = arch.description;
          variables["project_description"] = arch.description;
        }
      }

      variables["pricing_terms"] = variables["pricing_terms"] ?? "As agreed upon in the service order.";
      variables["product_name"] = variables["product_name"] ?? "[PRODUCT NAME]";
      variables["product_description"] = variables["product_description"] ?? "[PRODUCT DESCRIPTION]";
      variables["project_description"] = variables["project_description"] ?? "[PROJECT DESCRIPTION]";
      variables["rate"] = variables["rate"] ?? "[RATE]";
      variables["rate_type"] = variables["rate_type"] ?? "[RATE TYPE]";
      variables["payment_terms"] = variables["payment_terms"] ?? "Net 30";

      // Apply customizations
      if (customizations) {
        for (const [key, val] of Object.entries(customizations)) {
          variables[key] = val;
        }
      }

      // Fill template
      let content = template.content;
      for (const [key, val] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
      }

      // Identify unfilled variables
      const reviewNotes: string[] = [];
      const unfilledMatches = content.match(/\{\{[^}]+\}\}/g);
      if (unfilledMatches) {
        for (const match of unfilledMatches) {
          reviewNotes.push(`Variable ${match} was not filled — please provide a value.`);
        }
      }

      // Check for placeholder values
      const placeholders = content.match(/\[[A-Z\s]+\]/g);
      if (placeholders) {
        for (const ph of new Set(placeholders)) {
          reviewNotes.push(`Placeholder ${ph} needs to be replaced with actual value.`);
        }
      }

      reviewNotes.push("This is a template — have it reviewed by a legal professional before use.");

      // Save generated contract
      const storePath = join(HIVE_DIRS.businessContractGenerated, "store.yaml");
      let store: ContractStore;
      try {
        store = await readYaml<ContractStore>(storePath);
      } catch {
        store = { contracts: [] };
      }

      const contractId = `CTR-${String(store.contracts.length + 1).padStart(3, "0")}`;

      const contract: GeneratedContract = {
        id: contractId,
        type,
        client,
        project,
        content,
        variables_used: variables,
        review_notes: reviewNotes,
        status: "draft",
        created: now,
      };

      store.contracts.push(contract);
      await writeYaml(storePath, store);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                contract_id: contractId,
                type,
                name: template.name,
                content,
                variables_used: variables,
                review_notes: reviewNotes,
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
