import { useMemo } from "react";
import { addDays, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { getDayCapacity, effectiveHours, isWeekend } from "../engine/capacity";
import type { ScheduleContext } from "../engine/types";

interface WeekSummaryProps {
  context: ScheduleContext;
  weekStart: Date;
  resourceLabelPlural: string;
  showBillingStats?: boolean;
  monthlyGoal?: number;
  combinedBillingThisWeek?: number;
}

function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${amount}`;
}

export default function WeekSummary({
  context,
  weekStart,
  resourceLabelPlural,
  showBillingStats = false,
  monthlyGoal,
  combinedBillingThisWeek,
}: WeekSummaryProps) {
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

    let weekBilling = 0;
    let monthBilling = 0;
    const monthStart = startOfMonth(weekStart);
    const monthEnd = endOfMonth(weekStart);

    for (const line of context.schedule) {
      const emp = context.employees.get(line.employeeId);
      if (!emp) continue;
      const lineStart = line.startDateTime;
      const lineEnd = line.endDateTime;
      if (lineEnd >= start && lineStart < addDays(start, 7)) {
        totalScheduled += effectiveHours(line, emp);
      }
      const invoice = line.invoiceAmount ?? 0;
      if (invoice > 0) {
        if (lineStart >= start && lineStart < addDays(start, 7)) {
          weekBilling += invoice;
        }
        if (lineStart >= monthStart && lineStart <= monthEnd) {
          monthBilling += invoice;
        }
      }
    }

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
    };
  }, [context, weekStart]);

  const goalProgress =
    monthlyGoal && monthlyGoal > 0 ? stats.monthBilling / monthlyGoal : null;
  const combinedNoteWeek = combinedBillingThisWeek;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 12px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        marginBottom: 12,
        fontSize: 12,
        flexWrap: "wrap",
      }}
    >
      <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} highlight />
      <Stat label="Scheduled" value={`${stats.totalScheduled.toFixed(1)}h`} />
      <Stat label="Capacity" value={`${stats.totalCapacity.toFixed(0)}h`} />
      <Stat label="Jobs" value={String(stats.jobs)} />
      <Stat label="Lines" value={String(stats.lines)} />

      {showBillingStats && (
        <>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          <Stat
            label="Billing · week"
            value={formatMoney(stats.weekBilling)}
            money
          />
          {typeof combinedNoteWeek === "number" && combinedNoteWeek !== stats.weekBilling && (
            <Stat
              label="Both regions · week"
              value={formatMoney(combinedNoteWeek)}
              money
            />
          )}
          <Stat
            label="Billing · month"
            value={formatMoney(stats.monthBilling)}
            money
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

      <div style={{ flex: 1 }} />
      <div style={{ color: "var(--text-tertiary)", alignSelf: "center" }}>
        {context.employees.size} {resourceLabelPlural.toLowerCase()} this week
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  money = false,
  warning = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  money?: boolean;
  warning?: boolean;
}) {
  let color: string = "var(--text-primary)";
  if (highlight) color = "var(--lumineo-navy)";
  if (money) color = "#1b6e3e";
  if (warning) color = "#a0420f";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
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
