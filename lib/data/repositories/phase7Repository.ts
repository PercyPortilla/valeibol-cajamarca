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
  listPricingRules(): Promise<AdminPricingRule[]>;
  schedulePricingRule(input: SchedulePricingInput): Promise<SchedulePricingResult>;
  getOperationalMetrics(from: string, to: string): Promise<AdminOperationalMetrics>;
}

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
