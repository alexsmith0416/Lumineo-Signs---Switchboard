import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { isWeekend } from "../engine/capacity";
import { shiftTask, updateDuration } from "../engine/cascade";
import type { Conflict, Department, Employee, ScheduleLine } from "../engine/types";
import type { ScheduleKindMeta } from "../services/data-source";
import type { UseScheduleStore } from "../store/schedule-store";
import { useScenarioStore, type UseScenarioStore } from "../store/scenario-store";
import JobCard from "./JobCard";
import EditJobPanel from "./EditJobPanel";
import WeekSummary from "./WeekSummary";
import CascadeConfirmDialog, {
  summarizeCascadeMoves,
  type CascadeMove,
} from "./CascadeConfirmDialog";

interface CalendarViewProps {
  useStore: UseScheduleStore;
  kindMeta: ScheduleKindMeta;
  readOnly?: boolean;
  bannerSlot?: React.ReactNode;
  toolbarExtras?: React.ReactNode;
  addAction?: React.ReactNode;
  onEmptyCellClick?: (cell: { start: Date; employeeId: string }) => void;
  onJobClick?: (line: ScheduleLine) => void;
  /** Card layout: compact (default — single-line) or stacked (two-line, taller). */
  cardLayout?: "compact" | "stacked";
  /** Show invoice $ amount on cards. */
  showInvoice?: boolean;
  /** Show crew/truck badge on cards. */
  showCrewBadge?: boolean;
  /** Show weather chip on cards. */
  showWeather?: boolean;
  /** Add billing-aware stats to WeekSummary. */
  showBillingStats?: boolean;
  /** External monthly goal (combined across regions, used by WeekSummary). */
  monthlyGoal?: number;
  /** Combined billing reference total (used when a region toggle shows partial billing). */
  combinedBillingThisWeek?: number;
  /** Navigation callback so the dialog can jump to the Scenario Sandbox. */
  onNavigate?: (view: string) => void;
  /** Whether the "Try in Sandbox" option should appear in the cascade confirm dialog. */
  supportsScenarioSandbox?: boolean;
  /** Which scenario store to use for "Try in Sandbox". Defaults to the
   *  production scenario store; install / shipping calendars pass their
   *  own region-specific scenario store. */
  scenarioStore?: UseScenarioStore;
  /** Department IDs to hide from the rendered grid. */
  hiddenDeptIds?: Set<string>;
  /** Employee/resource IDs to hide from the rendered grid. */
  hiddenEmployeeIds?: Set<string>;
}

interface PendingShift {
  kind: "move" | "resize";
  lineId: string;
  newStart: Date;
  newEmployeeId?: string;
  newOverrideHours?: number;
  moves: CascadeMove[];
}

interface CardLayout {
  line: ScheduleLine;
  startIdx: number;
  spanDays: number;
  overflowLeft: boolean;
  overflowRight: boolean;
  lane: number;
}

function getDayIndex(date: Date, weekStart: Date): number {
  return differenceInCalendarDays(date, weekStart);
}

function computeRowCards(lines: ScheduleLine[], weekStart: Date): CardLayout[] {
  const out: CardLayout[] = [];
  const ordered = [...lines].sort(
    (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime(),
  );

  // Simple lane allocator: each new card uses the lowest lane that doesn't
  // overlap any prior card already placed in that lane.
  const laneEnds: number[] = [];

  for (const line of ordered) {
    const startIdx = getDayIndex(line.startDateTime, weekStart);
    const endIdx = getDayIndex(line.endDateTime, weekStart);
    if (endIdx < 0 || startIdx > 6) continue;
    const clippedStart = Math.max(0, startIdx);
    const clippedEnd = Math.min(6, endIdx);

    let lane = laneEnds.findIndex((end) => end < clippedStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(clippedEnd);
    } else {
      laneEnds[lane] = clippedEnd;
    }

    out.push({
      line,
      startIdx: clippedStart,
      spanDays: clippedEnd - clippedStart + 1,
      overflowLeft: startIdx < 0,
      overflowRight: endIdx > 6,
      lane,
    });
  }
  return out;
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
  cardLayout = "compact",
  showInvoice = false,
  showCrewBadge = false,
  showWeather = false,
  showBillingStats = false,
  monthlyGoal,
  combinedBillingThisWeek,
  onNavigate,
  supportsScenarioSandbox = false,
  scenarioStore = useScenarioStore,
  hiddenDeptIds,
  hiddenEmployeeIds,
}: CalendarViewProps) {
  const {
    weekStart,
    loading,
    error,
    employees,
    departments,
    schedule,
    conflicts,
    workHours,
    overtime,
    loadWeek,
    setWeekStart,
    shiftTaskAndCommit,
    updateTaskHours,
  } = useStore();

  const [editLineId, setEditLineId] = useState<string | null>(null);
  const [pendingShift, setPendingShift] = useState<PendingShift | null>(null);
  const enterScenario = scenarioStore((s) => s.enter);
  const addScenarioChange = scenarioStore((s) => s.addChange);
  const getContext = useStore((s) => s.getContext);

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
      if (hiddenEmployeeIds?.has(emp.id)) continue;
      const list = out.get(emp.departmentId) ?? [];
      list.push(emp);
      out.set(emp.departmentId, list);
    }
    const ordered: Array<{ dept: Department; emps: Employee[] }> = [];
    [...departments.values()]
      .sort((a, b) => a.flowOrder - b.flowOrder)
      .forEach((dept) => {
        if (hiddenDeptIds?.has(dept.id)) return;
        const emps = (out.get(dept.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
        // Include the dept even if empty — newly-added custom locations
        // and pinned-empty groups should still appear so the user sees them.
        ordered.push({ dept, emps });
      });
    return ordered;
  }, [employees, departments, hiddenDeptIds, hiddenEmployeeIds]);

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
    await tryShiftWithConfirm(lineId, newStart, employeeId);
  };

  const tryShiftWithConfirm = async (
    lineId: string,
    newStart: Date,
    newEmployeeId?: string,
  ) => {
    const ctx = getContext();
    const preview = shiftTask(ctx, lineId, newStart, newEmployeeId, {
      cascade: true,
      previewOnly: true,
    });
    const moves = summarizeCascadeMoves(ctx, preview, lineId);

    if (moves.length === 0) {
      await shiftTaskAndCommit(lineId, newStart, newEmployeeId, true);
      return;
    }
    setPendingShift({
      kind: "move",
      lineId,
      newStart,
      newEmployeeId,
      moves,
    });
  };

  const tryResizeWithConfirm = async (line: ScheduleLine, newHours: number) => {
    const ctx = getContext();
    const preview = updateDuration(ctx, line.id, newHours, true);
    const moves = summarizeCascadeMoves(ctx, preview, line.id);

    if (moves.length === 0) {
      await updateTaskHours(line.id, newHours);
      return;
    }
    setPendingShift({
      kind: "resize",
      lineId: line.id,
      newStart: line.startDateTime,
      newOverrideHours: newHours,
      moves,
    });
  };

  const commitPending = async (cascade: boolean) => {
    if (!pendingShift) return;
    const p = pendingShift;
    setPendingShift(null);
    if (p.kind === "move") {
      await shiftTaskAndCommit(p.lineId, p.newStart, p.newEmployeeId, cascade);
    } else if (p.kind === "resize" && p.newOverrideHours !== undefined) {
      // updateTaskHours always cascades; for "Move only this" we set the
      // override on a clone via the engine, then write back fields directly
      // — keep it simple here and call updateTaskHours (cascade=true) only
      // for the cascade branch. For move-only, we skip the cascade by going
      // through dataSource directly so downstream tasks aren't touched.
      if (cascade) {
        await updateTaskHours(p.lineId, p.newOverrideHours);
      } else {
        await applyResizeNoCascade(p.lineId, p.newOverrideHours);
      }
    }
  };

  const dataSource = useStore((s) => s.dataSource);
  async function applyResizeNoCascade(lineId: string, hours: number) {
    const ctx = getContext();
    const line = ctx.schedule.find((l) => l.id === lineId);
    if (!line) return;
    // Recompute only this line's end using the engine, no cascade.
    const r = updateDuration(ctx, lineId, hours, false);
    const updated = r.context.schedule.find((l) => l.id === lineId);
    if (!updated) return;
    await dataSource.updateScheduleLine(lineId, {
      startDateTime: updated.startDateTime,
      endDateTime: updated.endDateTime,
      overrideHours: updated.overrideHours,
    });
    await loadWeek();
  }

  const handleEnterScenario = () => {
    if (!pendingShift) return;
    const p = pendingShift;
    enterScenario(getContext());
    if (p.kind === "move") {
      addScenarioChange({
        type: "shift-task",
        lineId: p.lineId,
        newStart: p.newStart,
        ...(p.newEmployeeId ? { newEmployeeId: p.newEmployeeId } : {}),
      });
    } else if (p.kind === "resize" && p.newOverrideHours !== undefined) {
      addScenarioChange({
        type: "update-duration",
        lineId: p.lineId,
        overrideHours: p.newOverrideHours,
      });
    }
    setPendingShift(null);
    onNavigate?.("scenario");
  };

  if (loading) return <div className="loading">Loading schedule…</div>;
  if (error) return <div className="error">{error}</div>;

  const peopleNoun = (count: number) =>
    `${count} ${count === 1 ? kindMeta.resourceLabel.toLowerCase() : kindMeta.resourceLabelPlural.toLowerCase()}`;

  const context = { employees, departments, schedule, workHours, overtime };

  return (
    <div>
      {bannerSlot}
      <WeekSummary
        context={context}
        weekStart={weekStart}
        resourceLabelPlural={kindMeta.resourceLabelPlural}
        showBillingStats={showBillingStats}
        monthlyGoal={monthlyGoal}
        combinedBillingThisWeek={combinedBillingThisWeek}
      />
      <div className="calendar-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹ Prev</button>
        <button
          className="calendar-toolbar__today"
          onClick={() => setWeekStart(new Date())}
          disabled={
            startOfWeek(weekStart, { weekStartsOn: 1 }).getTime() ===
            startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
          }
          title="Jump back to this week"
        >
          Today
        </button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">Next ›</button>
        <div className="calendar-toolbar__label">Week of {format(weekStart, "MMM d, yyyy")}</div>
        <div className="calendar-toolbar__spacer" />
        {toolbarExtras}
        <button
          className="calendar-toolbar__print"
          onClick={() => window.print()}
          title="Print this week"
          aria-label="Print this week"
        >
          🖨
        </button>
        {addAction}
      </div>

      <div className="calendar-grid">
        <div className="calendar-header-row">
          <div className="calendar-header-cell calendar-header-cell--resource">
            {kindMeta.resourceLabel}
          </div>
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
              <div className="dept-header__label" style={{ background: dept.color }}>
                <span>{dept.name}</span>
                <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 11 }}>
                  flow {dept.flowOrder} · {peopleNoun(emps.length)}
                </span>
              </div>
            </div>
            {emps.map((emp) => {
              const empLines = schedule.filter((l) => l.employeeId === emp.id);
              const cards = computeRowCards(empLines, days[0]!);
              const maxLane = cards.reduce((m, c) => Math.max(m, c.lane), 0);
              const laneHeight = cardLayout === "stacked" ? 68 : 46;
              const rowMinHeight = (maxLane + 1) * laneHeight + 8;

              return (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  days={days}
                  cards={cards}
                  departments={departments}
                  conflicts={conflicts}
                  rowMinHeight={rowMinHeight}
                  laneHeight={laneHeight}
                  readOnly={readOnly}
                  cardLayout={cardLayout}
                  showInvoice={showInvoice}
                  showCrewBadge={showCrewBadge}
                  showWeather={showWeather}
                  highlightedLineIds={
                    pendingShift
                      ? new Set([pendingShift.lineId, ...pendingShift.moves.map((m) => m.line.id)])
                      : null
                  }
                  onCellDragOver={onCellDragOver}
                  onCellDrop={onCellDrop}
                  onCellClick={(day) => {
                    if (!onEmptyCellClick) return;
                    const start = new Date(day);
                    start.setHours(8, 0, 0, 0);
                    onEmptyCellClick({ start, employeeId: emp.id });
                  }}
                  onJobClick={(line) => {
                    if (onJobClick) onJobClick(line);
                    else setEditLineId(line.id);
                  }}
                  onResize={async (line, newHours) => {
                    await tryResizeWithConfirm(line, newHours);
                  }}
                />
              );
            })}
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

      {pendingShift && (() => {
        const targetLine = schedule.find((l) => l.id === pendingShift.lineId);
        if (!targetLine) return null;
        return (
          <CascadeConfirmDialog
            targetLine={targetLine}
            newStart={pendingShift.newStart}
            newEmployeeId={pendingShift.newEmployeeId}
            newOverrideHours={pendingShift.newOverrideHours}
            changeKind={pendingShift.kind}
            moves={pendingShift.moves}
            employeeName={(id) => employees.get(id)?.name ?? id}
            departmentName={(id) => departments.get(id)?.name ?? id}
            showScenarioOption={!!onNavigate && supportsScenarioSandbox}
            onCancel={() => setPendingShift(null)}
            onMoveOnly={() => commitPending(false)}
            onEnterScenario={handleEnterScenario}
            onContinue={() => commitPending(true)}
          />
        );
      })()}
    </div>
  );
}

interface EmployeeRowProps {
  emp: Employee;
  days: Date[];
  cards: CardLayout[];
  departments: Map<string, Department>;
  conflicts: Conflict[];
  rowMinHeight: number;
  laneHeight: number;
  readOnly: boolean;
  cardLayout: "compact" | "stacked";
  showInvoice: boolean;
  showCrewBadge: boolean;
  showWeather: boolean;
  highlightedLineIds: Set<string> | null;
  onCellDragOver: (e: React.DragEvent) => void;
  onCellDrop: (e: React.DragEvent, employeeId: string, day: Date) => void;
  onCellClick: (day: Date) => void;
  onJobClick: (line: ScheduleLine) => void;
  onResize: (line: ScheduleLine, newHours: number) => Promise<void>;
}

function EmployeeRow({
  emp,
  days,
  cards,
  departments,
  conflicts,
  rowMinHeight,
  laneHeight,
  readOnly,
  cardLayout,
  showInvoice,
  showCrewBadge,
  showWeather,
  highlightedLineIds,
  onCellDragOver,
  onCellDrop,
  onCellClick,
  onJobClick,
  onResize,
}: EmployeeRowProps) {
  const daysRef = useRef<HTMLDivElement>(null);

  return (
    <div className="employee-row" style={{ minHeight: rowMinHeight }}>
      <div className="employee-row__name">
        <strong>{emp.name}</strong>
        <span className="productivity">
          {Math.round(emp.productivityRate * 100)}% · {emp.standardHoursPerDay}h/day
        </span>
      </div>
      <div className="employee-row__days" ref={daysRef} style={{ minHeight: rowMinHeight }}>
        {days.map((day, i) => {
          const occupiedHere = cards.some(
            (c) => i >= c.startIdx && i < c.startIdx + c.spanDays,
          );
          const weekend = isWeekend(day);
          return (
            <div
              key={i}
              className={`day-cell${weekend ? " day-cell--weekend" : ""}${!occupiedHere ? " day-cell--empty" : ""}`}
              onDragOver={onCellDragOver}
              onDrop={(e) => onCellDrop(e, emp.id, day)}
              onClick={() => {
                if (!occupiedHere) onCellClick(day);
              }}
            />
          );
        })}

        {cards.map((card) => (
          <GanttCard
            key={card.line.id}
            card={card}
            department={departments.get(card.line.departmentId)}
            employee={emp}
            conflicts={conflicts}
            readOnly={readOnly}
            laneHeight={laneHeight}
            cardLayout={cardLayout}
            showInvoice={showInvoice}
            showCrewBadge={showCrewBadge}
            showWeather={showWeather}
            highlighted={highlightedLineIds?.has(card.line.id) ?? false}
            daysRef={daysRef}
            onClick={() => onJobClick(card.line)}
            onResize={(newHours) => onResize(card.line, newHours)}
          />
        ))}
      </div>
    </div>
  );
}

interface GanttCardProps {
  card: CardLayout;
  department: Department | undefined;
  employee: Employee;
  conflicts: Conflict[];
  readOnly: boolean;
  laneHeight: number;
  cardLayout: "compact" | "stacked";
  showInvoice: boolean;
  showCrewBadge: boolean;
  showWeather: boolean;
  highlighted: boolean;
  daysRef: React.RefObject<HTMLDivElement | null>;
  onClick: () => void;
  onResize: (newHours: number) => Promise<void>;
}

function GanttCard({
  card,
  department,
  employee,
  conflicts,
  readOnly,
  laneHeight,
  cardLayout,
  showInvoice,
  showCrewBadge,
  showWeather,
  highlighted,
  daysRef,
  onClick,
  onResize,
}: GanttCardProps) {
  const { line, startIdx, spanDays, overflowLeft, overflowRight, lane } = card;

  const [resizePreview, setResizePreview] = useState<{
    deltaPx: number;
    newHours: number;
  } | null>(null);

  const widthPct = (spanDays / 7) * 100;
  const leftPct = (startIdx / 7) * 100;
  const previewWidthPct = resizePreview
    ? widthPct + (resizePreview.deltaPx / (daysRef.current?.clientWidth || 1)) * 100
    : widthPct;

  const top = 4 + lane * laneHeight;

  const startResize = (e: React.MouseEvent) => {
    if (readOnly || line.isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    const dayContainer = daysRef.current;
    if (!dayContainer) return;
    const dayWidth = dayContainer.clientWidth / 7;
    const startX = e.clientX;
    const baseHours = line.overrideHours ?? line.estimatedHours;

    const onMove = (mv: MouseEvent) => {
      const deltaPx = mv.clientX - startX;
      const dayDelta = deltaPx / dayWidth;
      const hourDelta = dayDelta * employee.standardHoursPerDay;
      const proposed = Math.max(0.25, baseHours + hourDelta);
      const rounded = Math.round(proposed * 4) / 4; // nearest 0.25h
      setResizePreview({ deltaPx, newHours: rounded });
    };

    const onUp = (mv: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const deltaPx = mv.clientX - startX;
      const dayDelta = deltaPx / dayWidth;
      const hourDelta = dayDelta * employee.standardHoursPerDay;
      const proposed = Math.max(0.25, baseHours + hourDelta);
      const rounded = Math.round(proposed * 4) / 4;
      setResizePreview(null);
      if (Math.abs(rounded - baseHours) >= 0.25) {
        void onResize(rounded);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className={`gantt-card${overflowLeft ? " gantt-card--overflow-left" : ""}${overflowRight ? " gantt-card--overflow-right" : ""}${highlighted ? " gantt-card--highlighted" : ""}`}
      style={{
        left: `${leftPct}%`,
        width: `${previewWidthPct}%`,
        top,
        height: laneHeight - 8,
        bottom: "auto",
      }}
      draggable={!readOnly && !line.isLocked && !resizePreview}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/lineId", line.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <JobCard
        line={line}
        department={department}
        employee={employee}
        conflicts={conflicts}
        layout={cardLayout}
        showInvoice={showInvoice}
        showCrewBadge={showCrewBadge}
        showWeather={showWeather}
      />
      {!readOnly && !line.isLocked && (
        <>
          <div
            className="resize-handle resize-handle--right"
            onMouseDown={startResize}
            onClick={(e) => e.stopPropagation()}
            title="Drag to resize task duration"
          />
          {resizePreview && (
            <div
              style={{
                position: "absolute",
                top: -22,
                right: 0,
                background: "var(--lumineo-navy)",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: 3,
                fontSize: 10,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              {resizePreview.newHours}h
            </div>
          )}
        </>
      )}
    </div>
  );
}
