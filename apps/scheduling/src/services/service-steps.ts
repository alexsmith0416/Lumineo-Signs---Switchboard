/**
 * The SERVICE stepper (pure) — decided Sep 29, 2026: a service / contract
 * order runs Survey → Service → Complete to Admin → Complete Invoiced, beside
 * (or, for a service-only job, instead of) the production lifecycle stepper.
 *
 * A job is a service job when its BC Job Card "Order Type" is SERVICE,
 * SIGNCONT (Sign Contract Order) or MNTCCONT (Maintenance Contract Order)
 * (Alex, Oct 7). The order type reaches Dataverse through our BC API page
 * jobDescriptions (bc/lumineo-planning-ext v1.0.0.15) and the hourly
 * BCSync_JobDescriptions flow (crfdf_jobdesc.crfdf_ordertype).
 *
 * Service steps share the production stepper's stores: completions in
 * crfdf_jobdeptcompletion and editor add / remove / active in
 * crfdf_jobdeptoverride, under their own keys (SU, SE, SA, SI), so they never
 * mix with the production steps.
 */
import type { DepartmentStep } from "../components/DepartmentStepper";
import type { DeptOverride } from "./production-steps";

export const SERVICE_STEP_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "SU", label: "Survey" },
  { key: "SE", label: "Service" },
  { key: "SA", label: "Complete to Admin" },
  { key: "SI", label: "Complete Invoiced" },
];
/** The service Complete to Admin — completing it completes the job in BC. */
export const SERVICE_COMPLETE_TO_ADMIN = "SA";

const SERVICE_KEYS: ReadonlySet<string> = new Set(SERVICE_STEP_DEFS.map((d) => d.key));
export const isServiceKey = (key: string): boolean => SERVICE_KEYS.has(key);

/** BC Order Types that make a job a service job. */
export const SERVICE_ORDER_TYPES: ReadonlySet<string> = new Set(["SERVICE", "SIGNCONT", "MNTCCONT"]);
export const isServiceOrderType = (orderType: string | null | undefined): boolean =>
  SERVICE_ORDER_TYPES.has((orderType ?? "").trim().toUpperCase());

/** The service steps shown for a job: all four unless an editor removed one. */
export function serviceStepDefs(overrides: Record<string, DeptOverride> = {}): Array<{ key: string; label: string }> {
  return SERVICE_STEP_DEFS.filter((d) => overrides[d.key]?.included ?? true);
}

/** Service steps removed by an editor — the "add a step" pool. */
export function missingServiceStepDefs(overrides: Record<string, DeptOverride> = {}): Array<{ key: string; label: string }> {
  return SERVICE_STEP_DEFS.filter((d) => overrides[d.key]?.included === false);
}

/** Service stepper steps: completed / the first open one active (plus any an
 *  editor marked active) / the rest included — like the production stepper. */
export function buildServiceSteps(
  completed: ReadonlySet<string>,
  overrides: Record<string, DeptOverride> = {},
): DepartmentStep[] {
  const defs = serviceStepDefs(overrides);
  const first = defs.find((d) => !completed.has(d.key))?.key;
  return defs.map((d) => ({
    key: d.key,
    label: d.label,
    state: completed.has(d.key) ? "completed" : d.key === first || overrides[d.key]?.active ? "active" : "included",
  }));
}
