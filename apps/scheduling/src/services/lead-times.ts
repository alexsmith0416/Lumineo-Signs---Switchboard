/**
 * Lead times — how long after a job's release its manufacturing and install
 * should be done (pure).
 *
 * Default: Mfg Target = release + 7 weeks, Install Target = release + 10 weeks.
 * A list of rules (Settings → Lead times, Dataverse crfdf_leadtimerule) sets
 * other lead times for jobs by the combination of stepper steps they have, e.g.
 * "only Material Cut + Vinyl → 4 weeks". The FIRST matching rule, in list
 * order, wins; no match → the default.
 *
 * Mfg Final (the Airtable formula field): Mfg Modified when it's set and
 * differs from the target, else Mfg Target.
 */
import { addWeeks, format, isWeekend, nextMonday } from "date-fns";
import { ALL_STEP_DEFS, INSTALL_STEP } from "./production-steps";

export interface LeadTime {
  productionWeeks: number;
  installWeeks: number;
}

export const DEFAULT_LEAD_TIME: LeadTime = { productionWeeks: 7, installWeeks: 10 };

/**
 * How a rule's steps are compared with a job's production steps:
 *  - "only":     every production step the job has is one of these
 *                (a Vinyl-only job matches "only Material Cut + Vinyl").
 *  - "includes": the job has all of these steps (and maybe others).
 * Install is never part of the comparison.
 */
export type LeadTimeMatch = "only" | "includes";

export interface LeadTimeRule extends LeadTime {
  /** crfdf_leadtimeruleid ("" until saved). */
  id: string;
  name: string;
  /** Stepper step keys (MC, S, R, MF, P, V, A, CR). */
  steps: string[];
  match: LeadTimeMatch;
}

/** Steps a rule can name: the stepper's production steps. */
export const LEAD_TIME_STEP_OPTIONS: ReadonlyArray<{ key: string; label: string }> = ALL_STEP_DEFS.filter(
  (d) => d.key !== INSTALL_STEP.key,
);

/** Used until the rules list has been saved once (matches the old built-in rule). */
export const DEFAULT_RULES: LeadTimeRule[] = [
  { id: "", name: "Vinyl / Graphics only", steps: ["MC", "V"], match: "only", productionWeeks: 4, installWeeks: 7 },
];

export function ruleMatches(rule: LeadTimeRule, jobSteps: readonly string[]): boolean {
  const job = new Set(jobSteps.filter((k) => k !== INSTALL_STEP.key));
  if (job.size === 0 || rule.steps.length === 0) return false;
  const ruleSteps = new Set(rule.steps);
  return rule.match === "only"
    ? [...job].every((k) => ruleSteps.has(k))
    : rule.steps.every((k) => job.has(k));
}

/** The lead time for a job with these stepper steps: the first matching rule, else the default. */
export function leadTimeFor(
  jobSteps: readonly string[],
  rules: readonly LeadTimeRule[],
): LeadTime & { rule: LeadTimeRule | null } {
  const rule = rules.find((r) => ruleMatches(r, jobSteps)) ?? null;
  return rule
    ? { productionWeeks: rule.productionWeeks, installWeeks: rule.installWeeks, rule }
    : { ...DEFAULT_LEAD_TIME, rule: null };
}

/** Roll a weekend date FORWARD to Monday. */
export const forwardWorkingDay = (d: Date): Date => (isWeekend(d) ? nextMonday(d) : d);

const dayOf = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * The Jobs list's target dates ("YYYY-MM-DD", "" when there's no release date):
 *  - mfgTarget     = release + production lead (off a weekend)
 *  - installTarget = release + install lead (off a weekend)
 *  - mfgFinal      = mfgModified when set and different, else mfgTarget
 *                    (mfgModified alone when there's no release date)
 */
export function jobTargetDates(input: { release: string; lead: LeadTime; mfgModified: string }): {
  mfgTarget: string;
  installTarget: string;
  mfgFinal: string;
} {
  const release = dayOf(input.release);
  const mfgTarget = release ? ymd(forwardWorkingDay(addWeeks(release, input.lead.productionWeeks))) : "";
  const installTarget = release ? ymd(forwardWorkingDay(addWeeks(release, input.lead.installWeeks))) : "";
  const mod = dayOf(input.mfgModified) ? input.mfgModified : "";
  return { mfgTarget, installTarget, mfgFinal: mod && mod !== mfgTarget ? mod : mfgTarget };
}
