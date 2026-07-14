import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from "date-fns";
import { isWeekend } from "../engine/capacity";
import { diffShift, diffResize } from "../engine/cascade";
import type { Conflict, Department, Employee, ScheduleLine } from "../engine/types";
import type { ScheduleKind, ScheduleKindMeta } from "../services/data-source";
import { computeRosterReorder, type RosterDropTarget } from "../services/install-reorder";
import { printMarkup } from "../services/print";
import type { UseScheduleStore } from "../store/schedule-store";
import { useScenarioStore, type UseScenarioStore } from "../store/scenario-store";
import { CcoBadge } from "./CcoBadge";
import { LockIcon } from "./LockIcon";
import { PrintIcon } from "./PrintIcon";
import EmployeeAdminPanel from "./EmployeeAdminPanel";
import JobCard, { cardHasAddons } from "./JobCard";
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
  /** Show the "Total Value" (sum of jobs' remaining value) stat in WeekSummary. */
  showTotalValue?: boolean;
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
  /** Enables the right-click roster admin (add via group header, edit/delete
   *  via name). Set by the Production and Installation calendars. */
  enableResourceAdmin?: boolean;
  /** Installation only: the current region (crfdf_region) — false = WK,
   *  true = NEK. Required by the admin editor for install rosters. */
  installRegionIsNek?: boolean;
  /** Installation only: allow the roster to be "unlocked" for drag-reorder.
   *  The unlock state itself is toggled by right-clicking the resource column
   *  header (no visible button). */
  rosterUnlockable?: boolean;
  /** Production only: employee id → weekday indices (0=Mon) the person is lent
   *  to Installation. Those day cells render greyed + labelled "Installation". */
  assistDaysByEmployee?: Map<string, Set<number>>;
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

// Card vertical sizing. Gantt lanes are fixed-height, so a lane must be tall
// enough for the content of its tallest card or the text clips (overflow:
// hidden). We size each row's lanes to the max content-line count among its
// cards instead of a single constant, so adding lines (e.g. the BC job
// description) never truncates a card.
const CARD_LINE_PX = 15; // per text row (matches .job-card line-height: 1.3)
const CARD_LINE_GAP = 2; // .job-card gap between rows
const CARD_V_CHROME = 16; // .job-card padding (8) + .gantt-card top/bottom inset (8)

interface CardAddonFlags {
  showInvoice: boolean;
  showCrewBadge: boolean;
  showWeather: boolean;
}

/** Number of text rows a JobCard renders — mirrors JobCard's JSX so a lane can
 *  be sized to fit it exactly. */
function cardContentLines(
  line: ScheduleLine,
  layout: "compact" | "stacked",
  flags: CardAddonFlags,
): number {
  let lines = 1; // header (job# + customer) or custom title
  if (line.jobDescription) lines += 1;
  const hasDesc = line.shipmentLoadId ? true : Boolean(line.planningLineDescription);
  if (hasDesc) {
    if (layout === "stacked") {
      // Stacked desc honors newlines (merged install cards list each task).
      const descLines = line.shipmentLoadId
        ? 2
        : Math.min((line.planningLineDescription || "").split("\n").length, 4);
      lines += Math.max(1, descLines);
    } else {
      lines += 1; // compact desc is single-line (ellipsized)
    }
  }
  if (cardHasAddons(line, flags)) lines += 1; // addons row (only when it has content)
  return lines;
}

/** Lane height sized to the tallest card in the row, so no card clips its text. */
function computeLaneHeight(
  cards: CardLayout[],
  layout: "compact" | "stacked",
  flags: CardAddonFlags,
): number {
  const maxLines = cards.reduce(
    (m, c) => Math.max(m, cardContentLines(c.line, layout, flags)),
    1,
  );
  const content = maxLines * CARD_LINE_PX + (maxLines - 1) * CARD_LINE_GAP;
  const floor = layout === "stacked" ? 60 : 40;
  return Math.max(floor, content + CARD_V_CHROME);
}

// Last visible working-day column: Friday (4) when the employee doesn't work
// weekends, else Sunday (6). Weekends sit at indices 5–6 (Mon-first week), so
// clipping a bar's end to Friday makes a job that spills past Friday "skip the
// weekend" — it shows an overflow arrow and resumes on next week's Monday,
// mirroring the engine (weekends are zero-capacity for these employees).
function computeRowCards(lines: ScheduleLine[], weekStart: Date, skipWeekend: boolean): CardLayout[] {
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
    let clippedEnd = Math.min(6, endIdx);
    // Don't draw a weekday employee's bar across the weekend columns.
    if (skipWeekend && clippedStart <= 4) clippedEnd = Math.min(clippedEnd, 4);
    if (clippedEnd < clippedStart) continue;

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
      overflowRight: endIdx > clippedEnd,
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
  showTotalValue = false,
  monthlyGoal,
  combinedBillingThisWeek,
  onNavigate,
  supportsScenarioSandbox = false,
  scenarioStore = useScenarioStore,
  hiddenDeptIds,
  hiddenEmployeeIds,
  enableResourceAdmin = false,
  installRegionIsNek,
  rosterUnlockable = false,
  assistDaysByEmployee,
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
    updateResources,
  } = useStore();

  const [editLineId, setEditLineId] = useState<string | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  // Group id (department / location) right-clicked to add a new member.
  const [addGroupId, setAddGroupId] = useState<string | null>(null);
  const [pendingShift, setPendingShift] = useState<PendingShift | null>(null);
  // Right-click roster admin (add via header, edit/delete via name).
  const adminEditEnabled = enableResourceAdmin;

  // Roster reorder ("unlock" mode, install only): drag a name to a new
  // position / location group. Unlock is toggled by right-clicking the resource
  // column header (no visible button). `reorderDragId` marks an active drag (so
  // headers accept the drop); `reorderHoverId` drives the insertion indicator.
  const [rosterUnlocked, setRosterUnlocked] = useState(false);
  const rosterDragEnabled = rosterUnlockable && rosterUnlocked;
  const [reorderDragId, setReorderDragId] = useState<string | null>(null);
  const [reorderHoverId, setReorderHoverId] = useState<string | null>(null);
  const [headerDropLoc, setHeaderDropLoc] = useState<string | null>(null);
  // Printable grid element (used by the Print button). Declared with the other
  // hooks — above the loading/error early returns — to keep hook order stable.
  const gridRef = useRef<HTMLDivElement>(null);

  const applyRosterDrop = (draggedId: string, drop: RosterDropTarget) => {
    // Installation rosters carry a numeric location + explicit position, so a
    // drop renumbers the region (computeRosterReorder). Production employees
    // group by department id (string) with no manual ordering, so a drop simply
    // reassigns the dragged employee to the target department.
    if (kindMeta.kind === "installation") {
      const moves = computeRosterReorder([...employees.values()], draggedId, drop);
      if (moves.length === 0) return;
      void updateResources(
        moves.map((m) => ({ id: m.id, input: { location: m.location, position: m.position } })),
      );
      return;
    }
    const dragged = employees.get(draggedId);
    if (!dragged) return;
    const targetDept = drop.groupId ?? employees.get(drop.beforeId ?? "")?.departmentId;
    if (!targetDept || targetDept === dragged.departmentId) return;
    void updateResources([{ id: draggedId, input: { departmentId: targetDept } }]);
  };

  const onRosterDragStart = (e: React.DragEvent, empId: string) => {
    e.dataTransfer.setData("text/crewId", empId);
    e.dataTransfer.effectAllowed = "move";
    setReorderDragId(empId);
  };
  const onRosterDragEnd = () => {
    setReorderDragId(null);
    setReorderHoverId(null);
    setHeaderDropLoc(null);
  };
  const onRosterRowDragOver = (e: React.DragEvent, empId: string) => {
    if (!reorderDragId) return;
    e.preventDefault();
    if (reorderHoverId !== empId) setReorderHoverId(empId);
  };
  const onRosterRowDrop = (e: React.DragEvent, beforeEmpId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/crewId");
    onRosterDragEnd();
    if (draggedId) applyRosterDrop(draggedId, { beforeId: beforeEmpId });
  };
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
        // Installation rosters carry an explicit `position` (order on the
        // printed schedule); fall back to alphabetical when absent (production).
        const emps = (out.get(dept.id) ?? []).sort((a, b) => {
          if (a.position != null && b.position != null) return a.position - b.position;
          return a.name.localeCompare(b.name);
        });
        // Include the dept even if empty — newly-added custom locations
        // and pinned-empty groups should still appear so the user sees them.
        ordered.push({ dept, emps });
      });
    return ordered;
  }, [employees, departments, hiddenDeptIds, hiddenEmployeeIds]);

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
    const current = ctx.schedule.find((l) => l.id === lineId);
    // No-op guard: dropping a card back on its own day + resource changes
    // nothing — don't open a confirm dialog or write to the data source.
    if (
      current &&
      isSameDay(current.startDateTime, newStart) &&
      (!newEmployeeId || newEmployeeId === current.employeeId)
    ) {
      return;
    }

    const diff = diffShift(ctx, lineId, newStart, newEmployeeId, { cascade: true });
    const moves = summarizeCascadeMoves(ctx, diff, lineId);

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
    const diff = diffResize(ctx, line.id, newHours, true, true);
    const moves = summarizeCascadeMoves(ctx, diff, line.id);

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
    const r = diffResize(ctx, lineId, hours, false, true);
    const updated = r.target;
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
    <div className="calendar-view">
      {bannerSlot}
      <WeekSummary
        context={context}
        weekStart={weekStart}
        resourceLabelPlural={kindMeta.resourceLabelPlural}
        showBillingStats={showBillingStats}
        showTotalValue={showTotalValue}
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
          onClick={() => {
            const grid = gridRef.current;
            const heading = `${kindMeta.title} — Week of ${format(weekStart, "MMM d, yyyy")}`;
            if (!grid) {
              window.print();
              return;
            }
            printMarkup(
              heading,
              `<div class="print-doc__title">${heading}</div>` +
                `<div class="calendar-view">${grid.outerHTML}</div>`,
            );
          }}
          title="Print this week"
          aria-label="Print this week"
        >
          <PrintIcon />
        </button>
        {addAction}
      </div>

      <div className="calendar-grid" ref={gridRef}>
        <div className="calendar-header-row">
          <div
            className={
              "calendar-header-cell calendar-header-cell--resource" +
              (rosterUnlockable ? " calendar-header-cell--lockable" : "") +
              (rosterDragEnabled ? " calendar-header-cell--unlocked" : "")
            }
            onContextMenu={
              rosterUnlockable
                ? (e) => {
                    e.preventDefault();
                    setRosterUnlocked((v) => !v);
                  }
                : undefined
            }
            title={
              rosterUnlockable
                ? rosterDragEnabled
                  ? "Reorder unlocked — drag names to move. Right-click to lock."
                  : "Right-click to unlock drag-reordering"
                : undefined
            }
          >
            {kindMeta.resourceLabel}
            {rosterUnlockable && (
              <span className="resource-lock">
                <LockIcon locked={!rosterDragEnabled} />
              </span>
            )}
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
            <div
              className={`dept-header${adminEditEnabled ? " dept-header--editable" : ""}${headerDropLoc === dept.id ? " dept-header--drop" : ""}`}
              style={{ background: dept.color }}
              onContextMenu={
                adminEditEnabled
                  ? (e) => {
                      e.preventDefault();
                      setAddGroupId(dept.id);
                    }
                  : undefined
              }
              onDragOver={
                rosterDragEnabled && reorderDragId
                  ? (e) => {
                      e.preventDefault();
                      if (headerDropLoc !== dept.id) setHeaderDropLoc(dept.id);
                      setReorderHoverId(null);
                    }
                  : undefined
              }
              onDrop={
                rosterDragEnabled
                  ? (e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData("text/crewId");
                      onRosterDragEnd();
                      if (draggedId)
                        applyRosterDrop(draggedId, {
                          groupId: dept.id,
                          groupLocation: Number(dept.id),
                        });
                    }
                  : undefined
              }
              title={
                adminEditEnabled
                  ? `Right-click to add a ${kindMeta.resourceLabel.toLowerCase()}`
                  : undefined
              }
            >
              <div className="dept-header__label" style={{ background: dept.color }}>
                <span>{dept.name}</span>
                <span style={{ opacity: 0.6, fontWeight: 400, fontSize: 11 }}>
                  {peopleNoun(emps.length)}
                </span>
              </div>
            </div>
            {emps.map((emp) => {
              const empLines = schedule.filter((l) => l.employeeId === emp.id);
              const cards = computeRowCards(empLines, days[0]!, !emp.worksWeekends);
              const maxLane = cards.reduce((m, c) => Math.max(m, c.lane), 0);
              const laneHeight = computeLaneHeight(cards, cardLayout, {
                showInvoice,
                showCrewBadge,
                showWeather,
              });
              const rowMinHeight = (maxLane + 1) * laneHeight + 8;

              return (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  kind={kindMeta.kind}
                  onNameContextMenu={
                    adminEditEnabled ? () => setEditEmployeeId(emp.id) : undefined
                  }
                  rosterDraggable={rosterDragEnabled}
                  rosterDropHover={reorderHoverId === emp.id}
                  onRosterDragStart={
                    rosterDragEnabled ? (e) => onRosterDragStart(e, emp.id) : undefined
                  }
                  onRosterDragEnd={rosterDragEnabled ? onRosterDragEnd : undefined}
                  onRosterDragOver={
                    rosterDragEnabled ? (e) => onRosterRowDragOver(e, emp.id) : undefined
                  }
                  onRosterDrop={
                    rosterDragEnabled ? (e) => onRosterRowDrop(e, emp.id) : undefined
                  }
                  days={days}
                  cards={cards}
                  assistDays={assistDaysByEmployee?.get(emp.id)}
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

      {adminEditEnabled && editEmployeeId && (() => {
        const editing = employees.get(editEmployeeId);
        if (!editing) return null;
        return (
          <EmployeeAdminPanel
            kind={kindMeta.kind}
            mode="edit"
            emp={editing}
            departments={departments}
            regionIsNek={installRegionIsNek}
            useStore={useStore}
            onClose={() => setEditEmployeeId(null)}
          />
        );
      })()}

      {adminEditEnabled && addGroupId !== null && (
        <EmployeeAdminPanel
          kind={kindMeta.kind}
          mode="create"
          departments={departments}
          regionIsNek={installRegionIsNek}
          initialGroupId={addGroupId}
          useStore={useStore}
          onClose={() => setAddGroupId(null)}
        />
      )}

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
  kind: ScheduleKind;
  /** When set, right-clicking the name fires this (install admin edit). */
  onNameContextMenu?: () => void;
  /** Roster reorder ("unlock" mode) — drag the name to a new spot. */
  rosterDraggable?: boolean;
  rosterDropHover?: boolean;
  onRosterDragStart?: (e: React.DragEvent) => void;
  onRosterDragEnd?: () => void;
  onRosterDragOver?: (e: React.DragEvent) => void;
  onRosterDrop?: (e: React.DragEvent) => void;
  days: Date[];
  cards: CardLayout[];
  /** Weekday indices this employee is lent to Installation (greyed + labelled). */
  assistDays?: Set<number>;
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
  onCellDrop: (e: React.DragEvent, employeeId: string, day: Date) => void;
  onCellClick: (day: Date) => void;
  onJobClick: (line: ScheduleLine) => void;
  onResize: (line: ScheduleLine, newHours: number) => Promise<void>;
}

function EmployeeRow({
  emp,
  kind,
  onNameContextMenu,
  rosterDraggable,
  rosterDropHover,
  onRosterDragStart,
  onRosterDragEnd,
  onRosterDragOver,
  onRosterDrop,
  days,
  cards,
  assistDays,
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
  onCellDrop,
  onCellClick,
  onJobClick,
  onResize,
}: EmployeeRowProps) {
  const daysRef = useRef<HTMLDivElement>(null);
  // Day index currently under a drag, for the drop-target highlight. Null when
  // nothing is being dragged over this row.
  const [dropHoverIdx, setDropHoverIdx] = useState<number | null>(null);

  // Map a pointer x-coordinate to a 0–6 day index within the row's day strip.
  // This is what lets a drop ONTO an existing card resolve to the right day
  // (the card sits on top of the day cells, so its own position can't tell us
  // which day the cursor is over).
  const dayIndexFromClientX = (clientX: number): number => {
    const strip = daysRef.current;
    if (!strip) return 0;
    const rect = strip.getBoundingClientRect();
    return Math.max(0, Math.min(6, Math.floor(((clientX - rect.left) / rect.width) * 7)));
  };

  const handleStripDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const idx = dayIndexFromClientX(e.clientX);
    setDropHoverIdx((prev) => (prev === idx ? prev : idx));
  };

  const handleStripDrop = (e: React.DragEvent) => {
    setDropHoverIdx(null);
    if (readOnly) return;
    e.preventDefault();
    onCellDrop(e, emp.id, days[dayIndexFromClientX(e.clientX)]!);
  };

  return (
    <div className="employee-row" style={{ minHeight: rowMinHeight }}>
      <div
        className={
          "employee-row__name" +
          (onNameContextMenu ? " employee-row__name--editable" : "") +
          (rosterDraggable ? " employee-row__name--draggable" : "") +
          (rosterDropHover ? " employee-row__name--drop-before" : "")
        }
        draggable={rosterDraggable || undefined}
        onDragStart={onRosterDragStart}
        onDragEnd={onRosterDragEnd}
        onDragOver={onRosterDragOver}
        onDrop={onRosterDrop}
        onContextMenu={
          onNameContextMenu
            ? (e) => {
                e.preventDefault();
                onNameContextMenu();
              }
            : undefined
        }
        title={
          rosterDraggable
            ? "Drag to reorder · right-click to edit"
            : onNameContextMenu
              ? "Right-click to edit crew"
              : undefined
        }
      >
        <strong>
          {emp.name}
          {emp.isCertifiedCraneOperator ? <CcoBadge /> : null}
        </strong>
        {/* Installation rows show the assigned truck (when any) in place of the
            production %/hours subtext; production rows show no subtext at all
            (rate/hours are admin data, kept off the board). */}
        {kind === "installation" && emp.truckNumber ? (
          <span className="productivity">{emp.truckNumber}</span>
        ) : null}
      </div>
      <div
        className="employee-row__days"
        ref={daysRef}
        style={{ minHeight: rowMinHeight }}
        onDragLeave={(e) => {
          // Only clear when the drag actually leaves the strip, not when it
          // crosses between child cells/cards inside it.
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHoverIdx(null);
        }}
      >
        {days.map((day, i) => {
          const occupiedHere = cards.some(
            (c) => i >= c.startIdx && i < c.startIdx + c.spanDays,
          );
          const weekend = isWeekend(day);
          const assist = assistDays?.has(i) ?? false;
          return (
            <div
              key={i}
              className={`day-cell${weekend ? " day-cell--weekend" : ""}${!occupiedHere && !assist ? " day-cell--empty" : ""}${dropHoverIdx === i ? " day-cell--drop-target" : ""}${assist ? " day-cell--assist" : ""}`}
              onDragOver={assist ? undefined : handleStripDragOver}
              onDrop={assist ? undefined : handleStripDrop}
              onClick={() => {
                if (!occupiedHere && !assist) onCellClick(day);
              }}
            >
              {assist && <span className="day-cell__assist">Installation</span>}
            </div>
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
            // Drops landing on a card forward to the row strip so the task
            // stacks onto whatever day is under the cursor (lane allocator
            // handles the visual stacking).
            onCardDragOver={handleStripDragOver}
            onCardDrop={handleStripDrop}
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
  onCardDragOver: (e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent) => void;
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
  onCardDragOver,
  onCardDrop,
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

  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`gantt-card${overflowLeft ? " gantt-card--overflow-left" : ""}${overflowRight ? " gantt-card--overflow-right" : ""}${highlighted ? " gantt-card--highlighted" : ""}${dragging ? " gantt-card--dragging" : ""}`}
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
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      // Forward drops landing on this card to the row strip so the dragged
      // task stacks onto the day under the cursor instead of being lost.
      onDragOver={onCardDragOver}
      onDrop={onCardDrop}
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
