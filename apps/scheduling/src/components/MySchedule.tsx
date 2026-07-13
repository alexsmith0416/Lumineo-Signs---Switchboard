import { useEffect, useMemo } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import type { EmployeeGroup } from "../services/current-user";
import { GROUP_STORES } from "../services/employee-groups";

interface MyScheduleProps {
  group: EmployeeGroup;
  employeeId: string;
  /** Optional element rendered above the header (e.g. a back / switch button). */
  lead?: React.ReactNode;
}

/**
 * One employee's personal weekly schedule — the jobs/tasks assigned to them,
 * grouped by day. Reads the roster store for the given group. Week navigation
 * moves the shared roster week (same data the main calendar uses).
 */
export default function MySchedule({ group, employeeId, lead }: MyScheduleProps) {
  const store = GROUP_STORES[group];
  const employees = store((s) => s.employees);
  const schedule = store((s) => s.schedule);
  const weekStart = store((s) => s.weekStart);
  const loadWeek = store((s) => s.loadWeek);

  // Make sure this roster has been loaded at least once.
  useEffect(() => {
    if (employees.size === 0) void loadWeek();
  }, [employees.size, loadWeek]);

  const emp = employees.get(employeeId);
  const week = startOfWeek(weekStart, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  const mine = useMemo(
    () =>
      schedule
        .filter((l) => l.employeeId === employeeId)
        .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()),
    [schedule, employeeId],
  );

  const totalHours = mine.reduce((sum, l) => sum + (l.overrideHours ?? l.estimatedHours), 0);

  return (
    <div className="my-schedule">
      {lead}
      <div className="my-schedule__head">
        <div>
          <div className="my-schedule__who">{emp?.name ?? "Employee"}</div>
          <div className="my-schedule__sub">
            {emp?.truckNumber ? `${emp.truckNumber} · ` : ""}
            {mine.length} task{mine.length === 1 ? "" : "s"} · {totalHours.toFixed(1)}h this week
          </div>
        </div>
        <div className="my-schedule__weeknav">
          <button type="button" onClick={() => void loadWeek(addDays(week, -7))} aria-label="Previous week">‹</button>
          <span>Week of {format(week, "MMM d")}</span>
          <button type="button" onClick={() => void loadWeek(addDays(week, 7))} aria-label="Next week">›</button>
        </div>
      </div>

      <div className="my-schedule__days">
        {days.map((day) => {
          const dayTasks = mine.filter((l) => isSameDay(l.startDateTime, day));
          return (
            <div key={day.toISOString()} className="my-schedule__day">
              <div className="my-schedule__day-head">
                <strong>{format(day, "EEEE")}</strong>
                <span>{format(day, "MMM d")}</span>
              </div>
              {dayTasks.length === 0 ? (
                <div className="my-schedule__empty">—</div>
              ) : (
                dayTasks.map((l) => (
                  <div key={l.id} className="my-schedule__task">
                    <div className="my-schedule__task-time">
                      {format(l.startDateTime, "h:mm a")}
                      <span className="my-schedule__task-hours">
                        {(l.overrideHours ?? l.estimatedHours).toFixed(1)}h
                      </span>
                    </div>
                    <div className="my-schedule__task-job">{l.customerName || l.jobNo}</div>
                    {l.planningLineDescription && (
                      <div className="my-schedule__task-desc">{l.planningLineDescription}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
