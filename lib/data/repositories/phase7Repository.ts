import type {
  AdminCustomerHistoryItem,
  AdminCustomerSummary,
  AdminOperationalMetrics,
  AdminPricingRule,
  SchedulePricingInput,
  SchedulePricingResult,
} from "../../admin/phase7.ts";

export interface Phase7Repository {
  listCustomers(limit?: number): Promise<AdminCustomerSummary[]>;
  getCustomerHistory(customerId: string, limit?: number): Promise<AdminCustomerHistoryItem[]>;
  listCustomersPage(options?: {
    limit?: number;
    cursor?: AdminCustomerCursor | null;
  }): Promise<AdminCustomerPage>;
  getCustomer(customerId: string): Promise<AdminCustomerSummary>;
  getCustomerHistoryPage(customerId: string, options?: {
    limit?: number;
    cursor?: AdminCustomerHistoryCursor | null;
  }): Promise<AdminCustomerHistoryPage>;
  listPricingRules(): Promise<AdminPricingRule[]>;
  schedulePricingRule(input: SchedulePricingInput): Promise<SchedulePricingResult>;
  getOperationalMetrics(from: string, to: string): Promise<AdminOperationalMetrics>;
}

export type AdminCustomerCursor = {
  createdAt: string;
  id: string;
};

export type AdminCustomerPage = {
  items: AdminCustomerSummary[];
  nextCursor: AdminCustomerCursor | null;
};

export type AdminCustomerHistoryCursor = {
  createdAt: string;
  id: string;
};

export type AdminCustomerHistoryPage = {
  items: AdminCustomerHistoryItem[];
  nextCursor: AdminCustomerHistoryCursor | null;
};

export class Phase7RepositoryError extends Error {
  readonly code: "unauthorized" | "validation" | "conflict" | "not_found" | "network" | "unknown";

  constructor(
    code: "unauthorized" | "validation" | "conflict" | "not_found" | "network" | "unknown",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "Phase7RepositoryError";
  }
}
