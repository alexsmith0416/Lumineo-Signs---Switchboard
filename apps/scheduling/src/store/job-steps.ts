import type { DepartmentStep } from "../components/DepartmentStepper";
import { buildDepartmentSteps, type DeptOverride } from "../services/production-steps";
import { buildServiceSteps } from "../services/service-steps";
import { stepOrderFor } from "./job-flow-store";
import { isServiceJob } from "./service-jobs-store";

/**
 * Every step a job has, outside React: its production stepper (lifecycle
 * stages + departments + Install, in its flow order) followed by its Service
 * stepper when it's a service / contract job. What BC pushes, Sync to BC, the
 * status automation and the backfill act on. Call `ensureFlowsLoaded()` first
 * so the flow order and the order types are in.
 */
export function jobStepsFor(
  jobNo: string,
  info: { production: string[]; hasInstall: boolean },
  completed: ReadonlySet<string>,
  overrides: Record<string, DeptOverride> = {},
): DepartmentStep[] {
  const service = isServiceJob(jobNo);
  return [
    ...buildDepartmentSteps(info.production, new Set(completed), info.hasInstall, overrides, stepOrderFor(jobNo), service),
    ...(service ? buildServiceSteps(completed, overrides) : []),
  ];
}
