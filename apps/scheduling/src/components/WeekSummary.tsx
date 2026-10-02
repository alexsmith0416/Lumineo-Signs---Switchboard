import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { useBillingPeriodStore } from "../store/billing-period-store";
import { billingPeriodFor } from "../services/billing-periods";
import { dayLoad, getDayCapacity, isWeekend } from "../engine/capacity";
import type { ScheduleContext, ScheduleLine } from "../engine/types";
import { cardMoneyValue } from "./JobCard";

interface WeekSummaryProps {
  context: ScheduleContext;
  weekStart: Date;
  showBillingStats?: boolean;
  /** Show the billing period's goal (the goal itself comes from Settings →
   *  Billing periods). */
  showMonthlyGoal?: boolean;
  combinedBillingThisWeek?: number;
  /** Reads the board's cards for a date range, so the month's billing covers
   *  the whole billing period — not just the week on screen. */
  loadPeriodLines?: (from: Date, to: Date) => Promise<ScheduleLine[]>;
  /** Show a "Total Value" stat — sum of each current job's remaining value. */
  showTotalValue?: boolean;
  /** Show the utilization stats. Hidden for view-only users (the stats are an
   *  editor tool). Default true. */
  showStats?: boolean;
  /** Right-justified controls — undo/redo + Job Queue (tucked to the top-right). */
  trailing?: React.ReactNode;
  /** Left-most control, before the stats (the Installation board's WK/NEK toggle). */
  leading?: React.ReactNode;
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount}`;
}

export default function WeekSummary({
  context,
  weekStart,
  showBillingStats = false,
  showMonthlyGoal = false,
  combinedBillingThisWeek,
  loadPeriodLines,
  showTotalValue = false,
  showStats = true,
  trailing,
  leading,
}: WeekSummaryProps) {
  // The billing period (fiscal month) the viewed week sits in — its dates come
  // from each month's billing cut-off (Settings → Billing periods).
  const periodRows = useBillingPeriodStore((s) => s.rows);
  const loadPeriods = useBillingPeriodStore((s) => s.load);
  useEffect(() => {
    if (showBillingStats) void loadPeriods();
  }, [showBillingStats, loadPeriods]);
  const period = useMemo(
    () => billingPeriodFor(startOfWeek(weekStart, { weekStartsOn: 1 }), periodRows),
    [weekStart, periodRows],
  );
  const monthlyGoal = showMonthlyGoal ? period.goal : undefined;

  // The whole billing period's cards (plus a margin: a job's earlier cards, and
  // later ones that move its billing out). Re-read when the period changes.
  const [periodLines, setPeriodLines] = useState<ScheduleLine[] | null>(null);
  useEffect(() => {
    if (!showBillingStats || !loadPeriodLines) return;
    let live = true;
    loadPeriodLines(addDays(period.start, -42), addDays(period.end, 90))
      .then((lines) => live && setPeriodLines(lines))
      .catch((e) => console.warn("[week-summary] couldn't read the billing period", e));
    return () => {
      live = false;
    };
  }, [showBillingStats, loadPeriodLines, period.start, period.end]);

  const stats = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    let totalCapacity = 0;
    let totalScheduled = 0;
    let weekendCapacity = 0;

    for (const emp of context.employees.values()) {
      for (const day of days) {
        const cap = getDayCapacity(emp, day, context);
        totalCapacity += cap;
        if (isWeekend(day)) weekendCapacity += cap;
      }
    }

    const weekEnd = addDays(start, 7);

    // Count only the hours that actually land INSIDE this week. A job that
    // starts one week and runs into the next now loads on both boards, so
    // charging each week the job's whole hours would double-count it. dayLoad
    // pro-rates a multi-day card across the days it covers (and drops block-out
    // cards), so this total is exactly the sum of the per-day hover readouts.
    for (const emp of context.employees.values()) {
      for (const day of days) {
        totalScheduled += dayLoad(emp, day, context).scheduled;
      }
    }

    // $ figures are counted ONCE per job number — a job's value is the same on
    // every card/line of that job, so multiple cards must not multiply it.
    const weekJobs = new Map<string, number>();
    const allJobs = new Map<string, number>();
    // A job bills in the period its install ENDS in — its latest card end.
    const lastEnd = new Map<string, Date>();
    // The week on screen is live (edits show at once); the rest of the period
    // comes from periodLines.
    const onScreen = new Set(context.schedule.map((l) => l.id));
    const elsewhere = (periodLines ?? []).filter(
      (l) => !onScreen.has(l.id) && !(l.startDateTime >= start && l.startDateTime < weekEnd),
    );
    for (const line of [...context.schedule, ...elsewhere]) {
      const v = cardMoneyValue(line) ?? 0;
      if (v <= 0) continue;
      const s0 = line.startDateTime;
      if (!allJobs.has(line.jobNo)) allJobs.set(line.jobNo, v);
      if (s0 >= start && s0 < weekEnd && !weekJobs.has(line.jobNo)) weekJobs.set(line.jobNo, v);
      const prev = lastEnd.get(line.jobNo);
      if (!prev || line.endDateTime > prev) lastEnd.set(line.jobNo, line.endDateTime);
    }
    const monthJobs = new Map<string, number>();
    for (const [jobNo, end] of lastEnd) {
      if (end >= period.start && end < period.end) monthJobs.set(jobNo, allJobs.get(jobNo) ?? 0);
    }
    const sumValues = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    const weekBilling = sumValues(weekJobs);
    const monthBilling = sumValues(monthJobs);
    const totalValue = sumValues(allJobs);

    const utilization = totalCapacity > 0 ? totalScheduled / totalCapacity : 0;
    return {
      totalCapacity,
      totalScheduled,
      weekendCapacity,
      utilization,
      jobs: new Set(context.schedule.map((l) => l.jobNo)).size,
      lines: context.schedule.length,
      weekBilling,
      monthBilling,
      totalValue,
    };
  }, [context, weekStart, period, periodLines]);

  const goalProgress =
    monthlyGoal && monthlyGoal > 0 ? stats.monthBilling / monthlyGoal : null;
  const combinedNoteWeek = combinedBillingThisWeek;

  // Nothing to show — e.g. a view-only user (stats hidden, no editor controls).
  // Render nothing rather than an empty bar.
  if (!showStats && !trailing && !leading) return null;

  return (
    <div className="week-summary">
      {leading && <div className="week-summary__leading">{leading}</div>}
      {showStats && (
        <>
          <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} highlight />
          <Stat label="Scheduled" value={`${stats.totalScheduled.toFixed(1)}h`} />
          <Stat label="Capacity" value={`${stats.totalCapacity.toFixed(0)}h`} />
          <Stat label="Jobs" value={String(stats.jobs)} />
          <Stat label="Lines" value={String(stats.lines)} />

          {showTotalValue && (
            <>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <Stat label="Total Value" value={formatMoney(stats.totalValue)} money />
            </>
          )}

          {showBillingStats && (
            <>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <Stat label="Billing · week" value={formatMoney(stats.weekBilling)} money />
              {typeof combinedNoteWeek === "number" && combinedNoteWeek !== stats.weekBilling && (
                <Stat label="Both regions · week" value={formatMoney(combinedNoteWeek)} money />
              )}
              <Stat
                label={`Billing · ${format(new Date(`${period.month}-01T00:00:00`), "MMM")}`}
                value={formatMoney(stats.monthBilling)}
                money
                title={`Installs ending ${format(period.start, "MMM d")} – ${format(period.lastInstallDay, "MMM d")}${period.cutoffSet ? ` (cut-off ${format(period.cutoff, "MMM d")})` : ""}`}
              />
              {monthlyGoal && monthlyGoal > 0 && goalProgress !== null && (
                <Stat
                  label="Monthly goal"
                  value={`${Math.round(goalProgress * 100)}% of ${formatMoney(monthlyGoal)}`}
                  money={goalProgress >= 1}
                  warning={goalProgress < 0.9}
                />
              )}
            </>
          )}
        </>
      )}

      <div className="week-summary__spring" />
      {trailing && <div className="week-summary__trailing">{trailing}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  money = false,
  warning = false,
  title,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  money?: boolean;
  warning?: boolean;
  /** Hover text, e.g. the billing period's dates. */
  title?: string;
}) {
  let color: string = "var(--text-primary)";
  if (highlight) color = "var(--lumineo-navy)";
  if (money) color = "var(--status-green)";
  if (warning) color = "var(--status-amber)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }} title={title}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      <strong style={{ color, fontSize: 14 }}>{value}</strong>
    </div>
  );
}
