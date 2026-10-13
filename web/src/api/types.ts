export type Segment = "commute" | "touring" | "adventure" | "performance" | "ev";
export type VType = "car" | "bike" | "scooter";

export interface User {
  id: string; display_name: string; phone: string | null; email: string | null; role: "user" | "ops";
  profile: { city: string | null; interests: string[]; ownership_tags: string[]; story_done: boolean } | null;
  level: number; xp: number; next_at: number; title: string;
}
export interface Model {
  id: string; type: VType; make: string; model: string; variant: string; label: string; segment: Segment;
  price_low: number; price_high: number; specs: Record<string, string | number>; source: string; as_of: string;
}
export interface CollectionModel extends Model { badges: string[] }
export interface Progress {
  discovered: number; total: number; level: number; xp: number; next_at: number; title: string;
  segments: { id: Segment; label: string; total: number; discovered: number }[];
}
export interface Equity {
  known: boolean; reason: string | null; low: number | null; high: number | null; negative?: boolean; confidence: string | null;
}
export interface Vehicle {
  reminders?: { kind: string; due: string }[];
  id: string; type: VType; model: Model | null; label: string; verified_model: boolean; free_text_model: string | null;
  variant: string | null; year: number; ownership: "current" | "past"; city: string | null; odometer: number | null;
  condition: string | null; owners: number | null; accident_flag: boolean | null; modified_flag: boolean | null;
  rc_document_id: string | null; delivery_status: "pending" | "delivered" | null; source: string;
  valuation: { low: number; mid: number; high: number; confidence: string; source: string; as_of: string } | null;
  loan: { status: "none" | "active" | "unknown"; lender: string | null; principal: number | null; statement_date: string | null; source: string };
  equity: Equity; next_care: { kind: string; due: string } | null;
  care?: CareLog[];
}
export interface CareLog {
  id: string; kind: string; date: string; odometer: number; cost: number | null; notes: string | null;
  next_due: string | null; remind: boolean;
}
export interface GarageHome {
  vehicles: Vehicle[];
  total_equity: { low: number; high: number; counted: number; of: number } | null;
  care_task: { vehicle_id: string; vehicle: string; kind: string; due: string; overdue: boolean } | null;
  next_goal: { id: string; label: string; price_assumption: number; target_date: string | null; savings: number; monthly: number } | null;
  suggestions: Model[];
  collection: Progress;
}
export interface Goal {
  id: string; target_model: Model | null; price_assumption: number; target_date: string | null;
  savings: number; monthly: number; sell_current: string | null;
}
export interface Scenario {
  id: "save" | "used" | "sell_buy" | "finance"; title: string; summary: string; assumptions: string[];
  gap?: number; months?: number | null; price?: number; proceeds?: number; extra_funding_needed?: boolean; unavailable?: boolean;
  down_payment?: number; loan?: number; options?: { tenure: number; emi: number; interest: number }[];
}
export interface ScenarioResult {
  total_need: number; scenarios: Scenario[]; demo_note: string; goal: Goal;
  sell_vehicle: { id: string; label: string; equity: Equity; valuation: Vehicle["valuation"] } | null;
}

// ---- forms (lender-configurable) ----
export interface FieldSpec {
  name: string; label: string; type: string; required: boolean; options?: { value: string; label: string }[];
  help?: string; min?: number; max?: number; sensitive?: boolean; doc_kind?: string;
  show_if?: { field: string; equals: string };
  consent?: { type: string; purpose: string; recipient: string; version: string };
}
export interface RuleSpec {
  type: "sum_equals" | "age_range"; fields?: string[]; target?: string; tolerance?: number; field?: string; min?: number; max?: number; message: string;
}
export interface StepSpec {
  step: string; screen: string | null; title: string; intro: string; purpose: string; fields: FieldSpec[]; rules: RuleSpec[];
  lender: { id: string; name: string }; status: string; values: Record<string, unknown>; demo: boolean;
}

export interface Requirement {
  id: string; kind: string; category: string; reason: string; alternatives: string[]; status: "open" | "resolved";
  accepts: string[]; label: string;
}
export interface Doc {
  id: string; kind: string; filename: string; status: "uploading" | "processing" | "verified" | "needs_attention" | "rejected";
  reason: string | null; size: number; mime: string; requirement_id: string | null; extracted: Record<string, unknown>;
}
export interface Application {
  id: string; state: string; current_step: string; lender: { id: string; name: string }; amount: number; tenure: number;
  quote: number; contribution: number; model: { id: string; label: string } | null; steps: Record<string, string>;
  requirements: Requirement[]; exit_reason: string | null; accepted_offer_id: string | null; mandate_active: boolean;
  vehicle_id: string | null; demo: boolean; created_at: string; updated_at: string; documents?: Doc[];
}
export interface Offer {
  id: string; lender: string; amount: number; tenure: number; rate: number; apr: number; emi: number; fees: number;
  total: number; conditional: boolean; conditions: string[]; expires_at: string; kfs_version: string;
}
export interface Kfs {
  version: string; lender: string; offer: Offer; note: string; sections: { title: string; rows: [string, string | number][] }[];
}
export interface TimelineItem { id: number; type: string; summary: string; state: string | null; provider: string | null; at: string }
export interface Consent {
  id: string; type: string; purpose: string; recipient: string; text_version: string; granted_at: string;
  withdrawn_at: string | null; application_id: string | null;
}
export interface ApiErrorBody { code: string; message: string; field?: string | null; retryable?: boolean; errors?: { field: string; message: string }[] }
