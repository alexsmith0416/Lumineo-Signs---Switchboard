import { useEffect, useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { dayKey, isWeekend } from "../engine/capacity";
import type { Conflict, Department, Employee, ScheduleLine } from "../engine/types";
import type { ScheduleKindMeta } from "../services/data-source";
import type { UseScheduleStore } from "../store/schedule-store";
import JobCard from "./JobCard";
import EditJobPanel from "./EditJobPanel";

interface CalendarViewProps {
  useStore: UseScheduleStore;
  kindMeta: ScheduleKindMeta;
  readOnly?: boolean;
  bannerSlot?: React.ReactNode;
  toolbarExtras?: React.ReactNode;
  /** Rendered into the slot the production calendar uses for `+ Add Job`. */
  addAction?: React.ReactNode;
  /** Called when an empty cell is clicked. Receives the cell context. */
  onEmptyCellClick?: (cell: { start: Date; employeeId: string }) => void;
  /** Override the default click-to-edit behavior for existing job cards. */
  onJobClick?: (line: ScheduleLine) => void;
}

export default function CalendarView({
  useStore,
  kindMeta,
  readOnly = false,
  bannerSlot,
  toolbarExtras,
  addAction,
  onEmptyCellClick,
  onJobClick,
}: CalendarViewProps) {
  const {
    weekStart,
    loading,
    error,
    employees,
    departments,
    schedule,
    conflicts,
    loadWeek,
    setWeekStart,
    shiftTaskAndCommit,
  } = useStore();

  const [editLineId, setEditLineId] = useState<string | null>(null);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const days = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  const grouped = useMemo(() => {
    const out = new Map<string, Employee[]>();
    for (const emp of employees.values()) {
      const list = out.get(emp.departmentId) ?? [];
      list.push(emp);
      out.set(emp.departmentId, list);
    }
    const ordered: Array<{ dept: Department; emps: Employee[] }> = [];
    [...departments.values()]
      .sort((a, b) => a.flowOrder - b.flowOrder)
      .forEach((dept) => {
        const emps = (out.get(dept.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
        if (emps.length) ordered.push({ dept, emps });
      });
    return ordered;
  }, [employees, departments]);

  const onCellDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onCellDrop = async (e: React.DragEvent, employeeId: string, day: Date) => {
    if (readOnly) return;
    e.preventDefault();
    const lineId = e.dataTransfer.getData("text/lineId");
    if (!lineId) return;
    const newStart = new Date(day);
    newStart.setHours(8, 0, 0, 0);
    await shiftTaskAndCommit(lineId, newStart, employeeId, true);
  };

  if (loading) return <div className="loading">Loading schedule…</div>;
  if (error) return <div className="error">{error}</div>;

  const peopleNoun = (count: number) =>
    `${count} ${count === 1 ? kindMeta.resourceLabel.toLowerCase() : kindMeta.resourceLabelPlural.toLowerCase()}`;

  return (
    <div>
      {bannerSlot}
      <div className="calendar-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>‹ Prev</button>
        <div className="calendar-toolbar__label">Week of {format(weekStart, "MMM d, yyyy")}</div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>Next ›</button>
        <div className="calendar-toolbar__spacer" />
        {toolbarExtras}
        {addAction}
      </div>

      <div className="calendar-grid">
        <div className="calendar-header-row">
          <div className="calendar-header-cell">{kindMeta.resourceLabel}</div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={`calendar-header-cell${isWeekend(d) ? " calendar-header-cell--weekend" : ""}`}
            >
              <div>{format(d, "EEE")}</div>
              <div style={{ fontWeight: 400, fontSize: 11 }}>{format(d, "MMM d")}</div>
            </div>
          ))}
        </div>

        {grouped.map(({ dept, emps }) => (
          <div key={dept.id} className="dept-section">
            <div className="dept-header" style={{ background: dept.color }}>
              <span>{dept.name}</span>
              <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 11 }}>
                flow {dept.flowOrder} · {peopleNoun(emps.length)}
              </span>
            </div>
            {emps.map((emp) => (
              <div key={emp.id} className="employee-row">
                <div className="employee-row__name">
                  <strong>{emp.name}</strong>
                  <span className="productivity">
                    {Math.round(emp.productivityRate * 100)}% · {emp.standardHoursPerDay}h/day
                  </span>
                </div>
                {days.map((day) => {
                  const lines = schedule.filter(
                    (l) => l.employeeId === emp.id && isSameDay(l.startDateTime, day),
                  );
                  const weekend = isWeekend(day);
                  return (
                    <div
                      key={`${emp.id}-${dayKey(day)}`}
                      className={`employee-row__day${weekend ? " employee-row__day--weekend" : ""}${lines.length === 0 ? " employee-row__day--empty" : ""}`}
                      onDragOver={onCellDragOver}
                      onDrop={(e) => onCellDrop(e, emp.id, day)}
                      onClick={() => {
                        if (lines.length === 0 && onEmptyCellClick) {
                          const start = new Date(day);
                          start.setHours(8, 0, 0, 0);
                          onEmptyCellClick({ start, employeeId: emp.id });
                        }
                      }}
                    >
                      {lines.map((line) => (
                        <DraggableJob
                          key={line.id}
                          line={line}
                          department={departments.get(line.departmentId)}
                          conflicts={conflicts}
                          readOnly={readOnly}
                          onClick={() => {
                            if (onJobClick) onJobClick(line);
                            else setEditLineId(line.id);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {!onJobClick && editLineId && (() => {
        const editing = schedule.find((l) => l.id === editLineId);
        if (!editing) return null;
        return (
          <EditJobPanel
            line={editing}
            onClose={() => setEditLineId(null)}
            useStore={useStore}
          />
        );
      })()}
    </div>
  );
}

interface DraggableJobProps {
  line: ScheduleLine;
  department: Department | undefined;
  conflicts: Conflict[];
  readOnly: boolean;
  onClick: () => void;
}

function DraggableJob({ line, department, conflicts, readOnly, onClick }: DraggableJobProps) {
  return (
    <div
      draggable={!readOnly && !line.isLocked}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lineId", line.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ cursor: readOnly || line.isLocked ? "pointer" : "grab" }}
    >
      <JobCard line={line} department={department} conflicts={conflicts} />
    </div>
  );
}
