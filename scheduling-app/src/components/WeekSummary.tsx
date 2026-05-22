import { useMemo } from "react";
import { addDays, startOfWeek } from "date-fns";
import { getDayCapacity, effectiveHours, isWeekend } from "../engine/capacity";
import type { ScheduleContext } from "../engine/types";

interface WeekSummaryProps {
  context: ScheduleContext;
  weekStart: Date;
  resourceLabelPlural: string;
}

export default function WeekSummary({ context, weekStart, resourceLabelPlural }: WeekSummaryProps) {
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

    for (const line of context.schedule) {
      const emp = context.employees.get(line.employeeId);
      if (!emp) continue;
      const lineStart = line.startDateTime;
      const lineEnd = line.endDateTime;
      if (lineEnd < start || lineStart > addDays(start, 7)) continue;
      totalScheduled += effectiveHours(line, emp);
    }

    const utilization = totalCapacity > 0 ? totalScheduled / totalCapacity : 0;
    const conflicts = context.schedule.length > 0 ? null : null;
    return {
      totalCapacity,
      totalScheduled,
      weekendCapacity,
      utilization,
      conflicts,
      jobs: new Set(context.schedule.map((l) => l.jobNo)).size,
      lines: context.schedule.length,
    };
  }, [context, weekStart]);

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
      }}
    >
      <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} highlight />
      <Stat label="Scheduled" value={`${stats.totalScheduled.toFixed(1)}h`} />
      <Stat label="Capacity" value={`${stats.totalCapacity.toFixed(0)}h`} />
      <Stat label="Jobs" value={String(stats.jobs)} />
      <Stat label="Lines" value={String(stats.lines)} />
      <div style={{ flex: 1 }} />
      <div style={{ color: "var(--text-tertiary)", alignSelf: "center" }}>
        {context.employees.size} {resourceLabelPlural.toLowerCase()} this week
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
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
      <strong style={{ color: highlight ? "var(--lumineo-navy)" : "var(--text-primary)", fontSize: 14 }}>
        {value}
      </strong>
    </div>
  );
}
