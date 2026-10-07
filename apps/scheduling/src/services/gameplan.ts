/**
 * Monthly Gameplanning (pure) — the install-billing plan for a billing month.
 *
 *  - Booked: every WK / NEK install card. A job bills ONCE, at the calendar's
 *    value (BC remaining balance, else the card's invoice amount), in the week
 *    (and billing period) its install ENDS in — its latest card.
 *  - Pools of tracked jobs:
 *      Past due       — not installed, and its needed-by date has passed
 *                       (RED date, else Scheduled install, else Install Target).
 *                       Shown whether or not it's on an install board.
 *      Ready          — production done (Install is the active step), not on an
 *                       install board yet.
 *      Near complete  — one production step left, not on an install board yet.
 *  - Auto-fill: past-due jobs first, then by needed-by date, then the larger
 *    value; each goes in the first week of the month (from this week on) with
 *    room for its $ (toward the weekly target) and its install hours (the
 *    region's crew hours less what's booked). A near-complete job can't go
 *    before the week after its Mfg Final date.
 */
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import { COMPLETE_STATUSES } from "./job-status";
import { INSTALL_STEP, READY_FOR_INSTALL, isDeptKey } from "./production-steps";

export type Region = "WK" | "NEK";
export type Stage = "ready" | "near" | "other";

export interface PlanJob {
  jobNo: string;
  name: string;
  description: string;
  status: string;
  /** "WK" / "NEK" (install region; else region; else WK). */
  installRegion: string;
  /** Calendar $ value (BC remaining balance, else the Sales Order amount). */
  value: number;
  redDate: string;
  scheduledInstall: string;
  installTarget: string;
  mfgFinalDate: string;
  inBc: boolean;
  tracked: boolean;
}

export interface PlanStep {
  key: string;
  state: "completed" | "active" | "included";
}

export interface InstallLine {
  description: string;
  resourceNo: string;
  hours: number;
}

export interface PlanCandidate {
  jobNo: string;
  name: string;
  description: string;
  status: string;
  region: Region;
  value: number;
  installHours: number;
  crewPersons: number | null;
  stage: Stage;
  /** "YYYY-MM-DD" or "". */
  neededBy: string;
  neededBySource: "RED date" | "Scheduled install" | "Install target" | "";
  mfgFinalDate: string;
  onBoard: boolean;
  /** Days past the needed-by date (0 when not past due). */
  daysLate: number;
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const dayOf = (s: string): Date | null => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? parseISO(s) : null);
const regionOf = (r: string): Region => (r.trim().toUpperCase() === "NEK" ? "NEK" : "WK");

/** The date a job is needed by: RED date, else Scheduled install, else Install Target. */
export function neededByOf(j: Pick<PlanJob, "redDate" | "scheduledInstall" | "installTarget">): {
  date: string;
  source: PlanCandidate["neededBySource"];
} {
  if (j.redDate) return { date: j.redDate, source: "RED date" };
  if (j.scheduledInstall) return { date: j.scheduledInstall, source: "Scheduled install" };
  if (j.installTarget) return { date: j.installTarget, source: "Install target" };
  return { date: "", source: "" };
}

/** Where a job is in production, from its stepper. */
export function stageOf(steps: readonly PlanStep[]): Stage {
  // Ready = production done: Ready for Install (Oct 7) or Install itself is active.
  if (steps.some((s) => (s.key === INSTALL_STEP.key || s.key === READY_FOR_INSTALL.key) && s.state === "active")) return "ready";
  // Departments only — the lifecycle stages (New Order… Complete Invoiced) aren't production work.
  const openProduction = steps.filter((s) => isDeptKey(s.key) && s.state !== "completed");
  return openProduction.length === 1 ? "near" : "other";
}

/**
 * Install crew-hours and crew size from a job's install planning lines.
 * BC's install hours are per 2-man crew (one board lane); a job with several
 * trips has several crew lines, plus travel — all summed. A bigger crew line
 * ("WK 4 MAN") ties up more than one crew, so it counts men / 2 times.
 */
export function installWork(lines: readonly InstallLine[]): { hours: number; crewPersons: number | null } {
  let hours = 0;
  let men = 0;
  for (const l of lines) {
    const m = /(\d+)\s*MAN/i.exec(`${l.resourceNo} ${l.description}`);
    const n = m ? parseInt(m[1]!, 10) : 0;
    hours += (l.hours || 0) * Math.max(1, n / 2);
    men = Math.max(men, n);
  }
  return { hours: Math.round(hours * 10) / 10, crewPersons: men || null };
}

export function buildPools(input: {
  jobs: readonly PlanJob[];
  stepsFor: (jobNo: string) => readonly PlanStep[];
  installLinesFor: (jobNo: string) => readonly InstallLine[];
  /** Jobs with a card on an install board (any date). */
  onBoard: ReadonlySet<string>;
  today: Date;
}): { pastDue: PlanCandidate[]; ready: PlanCandidate[]; near: PlanCandidate[] } {
  const todayYmd = ymd(input.today);
  const pastDue: PlanCandidate[] = [];
  const ready: PlanCandidate[] = [];
  const near: PlanCandidate[] = [];
  for (const j of input.jobs) {
    if (!j.tracked || !j.inBc || COMPLETE_STATUSES.has(j.status)) continue;
    const steps = input.stepsFor(j.jobNo);
    if (steps.some((s) => s.key === INSTALL_STEP.key && s.state === "completed")) continue; // installed
    const { date, source } = neededByOf(j);
    const work = installWork(input.installLinesFor(j.jobNo));
    const due = dayOf(date);
    const daysLate = due && date < todayYmd ? Math.round((input.today.getTime() - due.getTime()) / 86_400_000) : 0;
    const c: PlanCandidate = {
      jobNo: j.jobNo,
      name: j.name,
      description: j.description,
      status: j.status,
      region: regionOf(j.installRegion),
      value: j.value,
      installHours: work.hours,
      crewPersons: work.crewPersons,
      stage: stageOf(steps),
      neededBy: date,
      neededBySource: source,
      mfgFinalDate: j.mfgFinalDate,
      onBoard: input.onBoard.has(j.jobNo),
      daysLate,
    };
    if (daysLate > 0) pastDue.push(c);
    if (c.onBoard) continue;
    if (c.stage === "ready") ready.push(c);
    else if (c.stage === "near") near.push(c);
  }
  const byNeed = (a: PlanCandidate, b: PlanCandidate) =>
    (a.neededBy || "9999").localeCompare(b.neededBy || "9999") || b.value - a.value;
  pastDue.sort((a, b) => b.daysLate - a.daysLate || b.value - a.value);
  ready.sort(byNeed);
  near.sort(byNeed);
  return { pastDue, ready, near };
}

// ── The month ────────────────────────────────────────────────────────────────

export interface BookedLine {
  jobNo: string;
  region: Region;
  startDateTime: Date;
  endDateTime: Date;
  /** The calendar $ value (cardMoneyValue), or null. */
  value: number | null;
  hours: number;
}

export interface WeekSlot {
  weekStart: Date;
  wk: number;
  nek: number;
  total: number;
  /** Install hours already booked in the week, by region. */
  hoursWK: number;
  hoursNEK: number;
  /** Jobs billing this week. */
  jobs: Array<{ jobNo: string; region: Region; value: number }>;
}

/** Monday-start weeks covering a billing period [start, end). */
export function monthWeeks(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let w = startOfWeek(start, { weekStartsOn: 1 }); w < end; w = addWeeks(w, 1)) out.push(w);
  return out;
}

/** Booked billing per week of the period: each job once, in the week its install ends. */
export function bookedByWeek(lines: readonly BookedLine[], period: { start: Date; end: Date }): WeekSlot[] {
  const slots: WeekSlot[] = monthWeeks(period.start, period.end).map((weekStart) => ({
    weekStart, wk: 0, nek: 0, total: 0, hoursWK: 0, hoursNEK: 0, jobs: [],
  }));
  const slotOf = (d: Date) => slots.find((s) => d >= s.weekStart && d < addDays(s.weekStart, 7));
  // Hours land in the week each card starts.
  for (const l of lines) {
    const s = slotOf(l.startDateTime);
    if (!s) continue;
    if (l.region === "WK") s.hoursWK += l.hours;
    else s.hoursNEK += l.hours;
  }
  // $: once per job, in the week its latest card ends, if that's in the period.
  const last = new Map<string, BookedLine>();
  for (const l of lines) {
    const p = last.get(l.jobNo);
    if (!p || l.endDateTime > p.endDateTime) last.set(l.jobNo, { ...l, value: l.value ?? p?.value ?? null });
    else if (p.value == null && l.value != null) p.value = l.value;
  }
  for (const l of last.values()) {
    if (!l.value || l.endDateTime < period.start || l.endDateTime >= period.end) continue;
    const s = slotOf(l.endDateTime);
    if (!s) continue;
    if (l.region === "WK") s.wk += l.value;
    else s.nek += l.value;
    s.total += l.value;
    s.jobs.push({ jobNo: l.jobNo, region: l.region, value: l.value });
  }
  return slots;
}

// ── Auto-fill ────────────────────────────────────────────────────────────────

export interface Placement {
  candidate: PlanCandidate;
  weekStart: Date;
}

export interface AutofillResult {
  placed: Placement[];
  skipped: Array<{ candidate: PlanCandidate; reason: string }>;
  added: number;
  remainingGap: number;
}

export function autofill(input: {
  candidates: readonly PlanCandidate[];
  weeks: readonly WeekSlot[];
  goal: number;
  /** Crew hours available per week, by region (before what's booked). */
  crewHours: Record<Region, number>;
  today: Date;
}): AutofillResult {
  const booked = input.weeks.reduce((n, w) => n + w.total, 0);
  const gap = Math.max(0, input.goal - booked);
  const thisWeek = startOfWeek(input.today, { weekStartsOn: 1 });
  const target = input.weeks.length ? input.goal / input.weeks.length : 0;
  const open = input.weeks.map((w) => ({
    weekStart: w.weekStart,
    usable: w.weekStart >= thisWeek,
    dollars: Math.max(0, target - w.total),
    WK: Math.max(0, input.crewHours.WK - w.hoursWK),
    NEK: Math.max(0, input.crewHours.NEK - w.hoursNEK),
  }));
  const order = [...input.candidates].sort(
    (a, b) =>
      Number(b.daysLate > 0) - Number(a.daysLate > 0) ||
      (a.neededBy || "9999").localeCompare(b.neededBy || "9999") ||
      b.value - a.value,
  );
  const placed: Placement[] = [];
  const skipped: AutofillResult["skipped"] = [];
  let added = 0;
  for (const c of order) {
    if (added >= gap) {
      skipped.push({ candidate: c, reason: "Goal already reached" });
      continue;
    }
    if (c.value <= 0) {
      skipped.push({ candidate: c, reason: "No $ value in BC" });
      continue;
    }
    // A near-complete job can't install before production finishes.
    const mfg = dayOf(c.mfgFinalDate);
    const earliest = c.stage === "near" ? startOfWeek(addDays(mfg ?? addWeeks(thisWeek, 1), 1), { weekStartsOn: 1 }) : thisWeek;
    const hours = c.installHours || 8;
    // First week with room for all of its $, else the first with any $ room.
    const fits = open.filter((o) => o.usable && o.weekStart >= earliest && o[c.region] >= hours);
    const w = fits.find((o) => o.dollars >= c.value) ?? fits.find((o) => o.dollars > 0);
    if (!w) {
      const anyHours = open.some((o) => o.usable && o.weekStart >= earliest && o[c.region] >= hours);
      skipped.push({
        candidate: c,
        reason: !open.some((o) => o.usable && o.weekStart >= earliest)
          ? "Production won't be done this billing month"
          : anyHours
            ? "No week has $ room left"
            : `No ${c.region} crew hours left (${hours}h needed)`,
      });
      continue;
    }
    w.dollars -= c.value;
    w[c.region] -= hours;
    placed.push({ candidate: c, weekStart: w.weekStart });
    added += c.value;
  }
  return { placed, skipped, added, remainingGap: Math.max(0, gap - added) };
}
