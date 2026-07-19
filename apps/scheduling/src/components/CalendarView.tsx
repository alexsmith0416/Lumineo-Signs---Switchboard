import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, isSameDay, startOfWeek } from "date-fns";
import { effectiveHours, isWeekend } from "../engine/capacity";
import { calculateEndTime } from "../engine/time-walker";
import { diffShift, diffResize } from "../engine/cascade";
import type { Conflict, Department, Employee, ScheduleLine } from "../engine/types";
import type { AssistHalf } from "../services/dataverse-live";
import type { ResourceAdminInput, ScheduleKind, ScheduleKindMeta } from "../services/data-source";
import { computeRosterReorder, type RosterDropTarget } from "../services/install-reorder";
import { isLaneEmployeeId, laneDeptId, laneEmployeeId, makeLaneEmployee } from "../services/department-lane";
import { printMarkup } from "../services/print";
import {
  useProductionQueueStore,
  useInstallQueueStoreWK,
  useInstallQueueStoreNEK,
} from "../store/job-queue-store";
import { lineFromQueueItem, queueItemFromLine } from "../services/job-queue-data";
import JobQueuePanel, { DND_QUEUE_ITEM } from "./JobQueuePanel";
import { QueueToggleIcon } from "./QueueIcons";
import type { UseScheduleStore } from "../store/schedule-store";
import { useScenarioStore, type UseScenarioStore } from "../store/scenario-store";
import { useSettingsStore } from "../store/settings-store";
import { useHistoryStore } from "../store/history-store";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { cardStepKey } from "../services/production-steps";
import { CcoBadge } from "./CcoBadge";
import { GroupIcon } from "./GroupIcon";
import { LockIcon } from "./LockIcon";
import { PrintIcon } from "./PrintIcon";
import EmployeeAdminPanel from "./EmployeeAdminPanel";
import JobCard, { cardHasAddons, cardAddonCount } from "./JobCard";
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
  /** Hide department groups that currently have zero visible members. Production
   *  passes this so e.g. an empty "Fabrication Help" banner doesn't clutter the
   *  board; the department still appears in the add-employee dropdown so it can
   *  be repopulated. Installation leaves it off (empty locations stay visible). */
  hideEmptyGroups?: boolean;
  /** Employee/resource IDs to hide from the rendered grid. */
  hiddenEmployeeIds?: Set<string>;
  /** Enables the right-click roster admin (add via group header, edit/delete
   *  via name). Set by the Production and Installation calendars. */
  enableResourceAdmin?: boolean;
  /** Enables department-wide ("team") scheduling: a shared lane under each
   *  department banner for jobs assigned to the whole team, plus a "+ Team job"
   *  button on the banner. Production only. */
  enableDepartmentLane?: boolean;
  /** Installation only: the current region (crfdf_region) — false = WK,
   *  true = NEK. Required by the admin editor for install rosters. */
  installRegionIsNek?: boolean;
  /** Installation only: allow the roster to be "unlocked" for drag-reorder.
   *  The unlock state itself is toggled by right-clicking the resource column
   *  header (no visible button). */
  rosterUnlockable?: boolean;
  /** Production only: employee id → (weekday index 0=Mon → which half). A "full"
   *  day renders greyed + labelled "Installation" and blocks scheduling; an
   *  "am"/"pm" half tints half the cell, labels "Install AM/PM", and still lets
   *  a production job land the other half. */
  assistDaysByEmployee?: Map<string, Map<number, AssistHalf>>;
  /** Enables the right-hand Job Queue slide-out (Production + Installation). */
  enableJobQueue?: boolean;
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
 *  be sized to fit it exactly. When `stackAddons` is set (narrow screens), the
 *  crew / weather / $ addons wrap onto their own lines instead of sharing one,
 *  so each counts as a line. */
function cardContentLines(
  line: ScheduleLine,
  layout: "compact" | "stacked",
  flags: CardAddonFlags,
  stackAddons: boolean,
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
  // Addons: one shared row on wide screens, one row per addon when stacked.
  lines += stackAddons ? cardAddonCount(line, flags) : cardHasAddons(line, flags) ? 1 : 0;
  return lines;
}

/** Lane height sized to the tallest card in the row, so no card clips its text. */
function computeLaneHeight(
  cards: CardLayout[],
  layout: "compact" | "stacked",
  flags: CardAddonFlags,
  stackAddons: boolean,
): number {
  const maxLines = cards.reduce(
    (m, c) => Math.max(m, cardContentLines(c.line, layout, flags, stackAddons)),
    1,
  );
  const content = maxLines * CARD_LINE_PX + (maxLines - 1) * CARD_LINE_GAP;
  const floor = layout === "stacked" ? 60 : 40;
  return Math.max(floor, content + CARD_V_CHROME);
}

/** True on mobile/tablet widths (≤900px), where day columns are too narrow to
 *  fit crew + weather + $ on one row — so addons stack vertically. */
function useStackedAddons(): boolean {
  const query = "(max-width: 900px)";
  const [stacked, setStacked] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setStacked(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return stacked;
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
  hideEmptyGroups = false,
  enableResourceAdmin = false,
  enableDepartmentLane = false,
  installRegionIsNek,
  rosterUnlockable = false,
  assistDaysByEmployee,
  enableJobQueue = false,
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
    shiftTaskAndCommit,
    updateTaskHours,
    moveRosterPermanent,
    moveRosterWeek,
    deleteScheduleLine,
    addScheduleLine,
  } = useStore();

  const [editLineId, setEditLineId] = useState<string | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  // Group id (department / location) right-clicked to add a new member.
  const [addGroupId, setAddGroupId] = useState<string | null>(null);
  // Right-click context menu on a department banner (production): offers
  // "Add employee" and "Add team job". Positioned at the cursor.
  const [bannerMenu, setBannerMenu] = useState<{ deptId: string; x: number; y: number } | null>(
    null,
  );
  const [pendingShift, setPendingShift] = useState<PendingShift | null>(null);
  // A roster name was dropped to a new spot — ask "this week" vs "permanent"
  // before committing (see the dialog near the bottom).
  const [pendingRosterMove, setPendingRosterMove] = useState<{
    edits: Array<{ id: string; input: ResourceAdminInput }>;
    name: string;
    targetLabel: string;
  } | null>(null);
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
    // Build the roster edits, then ask "this week vs permanent" before committing.
    // Installation rosters carry a numeric location + explicit position, so a
    // drop renumbers the region (computeRosterReorder). Production employees
    // group by department id (string) with no manual ordering, so a drop simply
    // reassigns the dragged employee to the target department.
    const dragged = employees.get(draggedId);
    if (!dragged) return;
    let edits: Array<{ id: string; input: ResourceAdminInput }>;
    let targetLabel: string;
    if (kindMeta.kind === "installation") {
      const moves = computeRosterReorder([...employees.values()], draggedId, drop);
      if (moves.length === 0) return;
      edits = moves.map((m) => ({ id: m.id, input: { location: m.location, position: m.position } }));
      const loc = moves.find((m) => m.id === draggedId)?.location;
      targetLabel =
        loc != null ? departments.get(String(loc))?.name ?? `Location ${loc}` : "a new spot";
    } else {
      const targetDept = drop.groupId ?? employees.get(drop.beforeId ?? "")?.departmentId;
      if (!targetDept || targetDept === dragged.departmentId) return;
      edits = [{ id: draggedId, input: { departmentId: targetDept } }];
      targetLabel = departments.get(targetDept)?.name ?? "another department";
    }
    setPendingRosterMove({ edits, name: dragged.name, targetLabel });
  };

  const commitRosterMove = (scope: "week" | "permanent") => {
    if (!pendingRosterMove) return;
    const { edits } = pendingRosterMove;
    setPendingRosterMove(null);
    if (scope === "week") void moveRosterWeek(edits, weekStart);
    else void moveRosterPermanent(edits, weekStart);
  };

  // Right-click card actions. Delete removes the card; Duplicate drops an
  // identical copy on the same resource immediately after the original (so it
  // doesn't overlap), which the user can then drag/edit.
  const handleDeleteLine = (line: ScheduleLine) => {
    void deleteScheduleLine(line.id);
  };
  const handleDuplicateLine = (line: ScheduleLine) => {
    const ctx = getContext();
    const emp = ctx.employees.get(line.employeeId);
    const start = new Date(line.endDateTime);
    const copy: ScheduleLine = {
      ...line,
      id: `line-${line.jobNo || "job"}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      startDateTime: start,
      preferredStart: start,
    };
    const end = emp ? calculateEndTime(start, effectiveHours(copy, emp), emp, ctx, copy.id) : line.endDateTime;
    void addScheduleLine({ ...copy, endDateTime: end });
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
  // Undo/redo history for this board (move/resize/add/delete). Session-scoped,
  // 20 steps, cleared on reload — see history-store.
  const boardId = useStore((s) => s.boardId);
  const boardHistory = useHistoryStore((s) => s.boards[boardId]);
  const canUndo = !readOnly && !!boardHistory?.undo.length;
  const canRedo = !readOnly && !!boardHistory?.redo.length;
  const undoLabel = boardHistory?.undo[boardHistory.undo.length - 1]?.label;
  const redoLabel = boardHistory?.redo[boardHistory.redo.length - 1]?.label;
  const doUndo = () => void useHistoryStore.getState().undo(boardId);
  const doRedo = () => void useHistoryStore.getState().redo(boardId);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo. Ignored while typing
  // in a field or on read-only boards.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        void useHistoryStore.getState().undo(boardId);
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        void useHistoryStore.getState().redo(boardId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boardId, readOnly]);
  // Cascade / conflict prompt on/off (Settings). When off, moves & resizes
  // apply as a full override (move only, no dialog, no auto-move of others).
  const cascadeEnabled = useSettingsStore((s) => s.cascadeEnabled);
  const setCascadeEnabled = useSettingsStore((s) => s.setCascadeEnabled);
  // Presentation ("TV") mode: drop everything above the grid (banner, week
  // summary, toolbar) so only the eyebrow/title + calendar show — see App.tsx.
  const presentationMode = useSettingsStore((s) => s.presentationMode);
  // Narrow screens stack the crew/weather/$ addons vertically (they don't fit
  // on one row in a mobile day column) — the lane grows to fit them.
  const stackAddons = useStackedAddons();

  // --- Job Queue (Production + Installation) -------------------------------
  // Pick the per-board queue store (each board keeps its own queue). Selecting a
  // store REFERENCE here (not calling a hook conditionally) keeps hook order stable.
  const queueStore =
    kindMeta.kind === "installation"
      ? installRegionIsNek
        ? useInstallQueueStoreNEK
        : useInstallQueueStoreWK
      : useProductionQueueStore;
  const [queueOpen, setQueueOpen] = useState(false);

  // Drop a queue card onto a cell → create a schedule line from it (instant
  // placement with the job's stored hours/dept), then remove it from the queue.
  const placeQueueItem = (itemId: string, employeeId: string, day: Date) => {
    const q = queueStore.getState();
    const item = q.groups.flatMap((g) => g.items).find((it) => it.id === itemId);
    if (!item) return;
    const isLane = isLaneEmployeeId(employeeId);
    const deptId = isLane ? laneDeptId(employeeId) : employees.get(employeeId)?.departmentId ?? "";
    const emp = isLane
      ? makeLaneEmployee(departments.get(deptId) ?? { id: deptId, name: "Team", flowOrder: 0, color: "#cccccc" })
      : employees.get(employeeId);
    if (!emp) return;
    const start = new Date(day);
    start.setHours(8, 0, 0, 0);
    const base = lineFromQueueItem(item, employeeId, deptId, start);
    const line = isLane ? { ...base, departmentWide: true as const } : base;
    const end = calculateEndTime(start, effectiveHours(line, emp), emp, getContext(), line.id);
    void addScheduleLine({ ...line, endDateTime: end });
    q.removeItem(itemId);
  };

  // Drop a calendar card into a queue group → store it, then delete the line.
  const handleCalendarCardToQueue = (lineId: string, groupId: string) => {
    const line = schedule.find((l) => l.id === lineId);
    if (!line) return;
    const q = queueStore.getState();
    const group = q.groups.find((g) => g.id === groupId);
    q.addItem(queueItemFromLine(line, groupId, group ? group.items.length : 0));
    void deleteScheduleLine(lineId);
  };

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
        // Production hides zero-member departments (hideEmptyGroups) to keep the
        // board tidy — the dept still shows in the add-employee dropdown, so it
        // reappears once someone is assigned. Installation keeps empty locations
        // visible (newly-added custom locations / pinned-empty groups).
        if (hideEmptyGroups && emps.length === 0) return;
        ordered.push({ dept, emps });
      });
    return ordered;
  }, [employees, departments, hiddenDeptIds, hiddenEmployeeIds, hideEmptyGroups]);

  const onCellDrop = async (e: React.DragEvent, employeeId: string, day: Date) => {
    if (readOnly) return;
    e.preventDefault();
    // A card dragged from the Job Queue: place it here and remove it from the queue.
    const queueItemId = e.dataTransfer.getData(DND_QUEUE_ITEM);
    if (queueItemId) {
      placeQueueItem(queueItemId, employeeId, day);
      return;
    }
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

    // Cascade off (full override): move only this task, no dialog.
    if (!cascadeEnabled) {
      await shiftTaskAndCommit(lineId, newStart, newEmployeeId, false);
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
    // Cascade off (full override): resize this task only, no dialog.
    if (!cascadeEnabled) {
      await updateTaskHours(line.id, newHours, false);
      return;
    }
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
      // "Cascade" resizes and pushes downstream tasks; "Move only this" resizes
      // just this task (cascade=false). Both are optimistic — the card grows in
      // place with no reload.
      await updateTaskHours(p.lineId, p.newOverrideHours, cascade);
    }
  };

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
      {!presentationMode && bannerSlot}
      {!presentationMode && (
        <WeekSummary
          context={context}
          weekStart={weekStart}
          resourceLabelPlural={kindMeta.resourceLabelPlural}
          showBillingStats={showBillingStats}
          showTotalValue={showTotalValue}
          monthlyGoal={monthlyGoal}
          combinedBillingThisWeek={combinedBillingThisWeek}
          trailing={
            !readOnly || enableJobQueue ? (
              <>
                {!readOnly && (
                  <div className="history-group">
                    <button
                      type="button"
                      className="history-btn"
                      onClick={doUndo}
                      disabled={!canUndo}
                      title={canUndo ? `Undo ${undoLabel} (Ctrl+Z)` : "Nothing to undo"}
                      aria-label="Undo"
                    >
                      ↶
                    </button>
                    <button
                      type="button"
                      className="history-btn"
                      onClick={doRedo}
                      disabled={!canRedo}
                      title={canRedo ? `Redo ${redoLabel} (Ctrl+Y)` : "Nothing to redo"}
                      aria-label="Redo"
                    >
                      ↷
                    </button>
                  </div>
                )}
                {enableJobQueue && (
                  <button
                    type="button"
                    className={"wk-queue-toggle" + (queueOpen ? " wk-queue-toggle--on" : "")}
                    onClick={() => setQueueOpen((v) => !v)}
                    title="Toggle the Job Queue"
                    aria-pressed={queueOpen}
                  >
                    <QueueToggleIcon size={16} />
                    <span>Job Queue</span>
                  </button>
                )}
              </>
            ) : undefined
          }
        />
      )}
      {!presentationMode && (
      <div className="calendar-toolbar">
        {/* Navigate via loadWeek (not setWeekStart) so the target week's data is
            actually fetched — live schedule lines are queried per week, so a
            state-only week change would show an empty/stale week. */}
        <button onClick={() => void loadWeek(addDays(weekStart, -7))} aria-label="Previous week">‹ Prev</button>
        <button
          className="calendar-toolbar__today"
          onClick={() => void loadWeek(new Date())}
          disabled={
            startOfWeek(weekStart, { weekStartsOn: 1 }).getTime() ===
            startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
          }
          title="Jump back to this week"
        >
          Today
        </button>
        <button onClick={() => void loadWeek(addDays(weekStart, 7))} aria-label="Next week">Next ›</button>
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
      )}

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
                      // Department lane enabled (production): show a small menu
                      // with Add employee / Add team job. Otherwise (install)
                      // right-click adds an employee directly, as before.
                      if (enableDepartmentLane) {
                        setBannerMenu({ deptId: dept.id, x: e.clientX, y: e.clientY });
                      } else {
                        setAddGroupId(dept.id);
                      }
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
                  ? enableDepartmentLane
                    ? "Right-click for options (add employee / team job)"
                    : `Right-click to add a ${kindMeta.resourceLabel.toLowerCase()}`
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
            {(() => {
              // Prepend the shared "team" lane row when this department has any
              // department-wide jobs. The lane is a synthetic resource whose id
              // matches those lines' employeeId, so the same row machinery below
              // (empLines filter, cards, drag) works unchanged.
              const laneRow =
                enableDepartmentLane &&
                schedule.some((l) => l.departmentWide && l.departmentId === dept.id)
                  ? makeLaneEmployee(dept)
                  : null;
              return (laneRow ? [laneRow, ...emps] : emps);
            })().map((emp) => {
              const empLines = schedule.filter((l) => l.employeeId === emp.id);
              const cards = computeRowCards(empLines, days[0]!, !emp.worksWeekends);
              const maxLane = cards.reduce((m, c) => Math.max(m, c.lane), 0);
              const laneHeight = computeLaneHeight(
                cards,
                cardLayout,
                { showInvoice, showCrewBadge, showWeather },
                stackAddons,
              );
              const rowMinHeight = (maxLane + 1) * laneHeight + 8;

              return (
                <EmployeeRow
                  key={emp.id}
                  emp={emp}
                  kind={kindMeta.kind}
                  onNameContextMenu={
                    adminEditEnabled && !emp.isDepartmentLane
                      ? () => setEditEmployeeId(emp.id)
                      : undefined
                  }
                  rosterDraggable={rosterDragEnabled && !emp.isDepartmentLane}
                  rosterDropHover={reorderHoverId === emp.id}
                  onRosterDragStart={
                    rosterDragEnabled && !emp.isDepartmentLane
                      ? (e) => onRosterDragStart(e, emp.id)
                      : undefined
                  }
                  onRosterDragEnd={
                    rosterDragEnabled && !emp.isDepartmentLane ? onRosterDragEnd : undefined
                  }
                  onRosterDragOver={
                    rosterDragEnabled && !emp.isDepartmentLane
                      ? (e) => onRosterRowDragOver(e, emp.id)
                      : undefined
                  }
                  onRosterDrop={
                    rosterDragEnabled && !emp.isDepartmentLane
                      ? (e) => onRosterRowDrop(e, emp.id)
                      : undefined
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
                  canAddJob={!!onEmptyCellClick}
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
                  onDuplicateLine={readOnly ? undefined : handleDuplicateLine}
                  onDeleteLine={readOnly ? undefined : handleDeleteLine}
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
            readOnly={readOnly}
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
          initialGroupId={addGroupId ?? undefined}
          useStore={useStore}
          onClose={() => setAddGroupId(null)}
        />
      )}

      {bannerMenu && (
        <>
          <div className="context-menu__backdrop" onClick={() => setBannerMenu(null)} />
          <div
            className="context-menu"
            style={{ top: bannerMenu.y, left: bannerMenu.x }}
            role="menu"
          >
            <button
              type="button"
              className="context-menu__item"
              onClick={() => {
                setAddGroupId(bannerMenu.deptId);
                setBannerMenu(null);
              }}
            >
              Add employee…
            </button>
            {!readOnly && onEmptyCellClick && (
              <button
                type="button"
                className="context-menu__item"
                onClick={() => {
                  const start = new Date(days[0]!);
                  start.setHours(8, 0, 0, 0);
                  onEmptyCellClick({ start, employeeId: laneEmployeeId(bannerMenu.deptId) });
                  setBannerMenu(null);
                }}
              >
                Add team job…
              </button>
            )}
          </div>
        </>
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
            onTurnOff={() => {
              setCascadeEnabled(false);
              void commitPending(false);
            }}
          />
        );
      })()}

      {enableJobQueue && (
        <JobQueuePanel
          useQueueStore={queueStore}
          open={queueOpen}
          onClose={() => setQueueOpen(false)}
          canEdit={!readOnly}
          departments={[...departments.values()]}
          onCalendarCardDrop={handleCalendarCardToQueue}
        />
      )}

      {pendingRosterMove && (
        <div className="modal-scrim" onClick={() => setPendingRosterMove(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-card__title">Move {pendingRosterMove.name}</div>
            <div className="modal-card__body">
              Move <strong>{pendingRosterMove.name}</strong> to {pendingRosterMove.targetLabel} — just
              for the week of {format(weekStart, "MMM d")}, or permanently?
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                <strong>This week only</strong> changes just this week&apos;s schedule.{" "}
                <strong>Permanent</strong> updates the roster for every week.
              </div>
            </div>
            <div className="modal-card__actions">
              <button className="btn-secondary" onClick={() => setPendingRosterMove(null)}>
                Cancel
              </button>
              <button className="btn-secondary" onClick={() => commitRosterMove("week")}>
                This week only
              </button>
              <button className="btn-primary" onClick={() => commitRosterMove("permanent")}>
                Permanent
              </button>
            </div>
          </div>
        </div>
      )}
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
  /** Weekday index → which half this employee is lent to Installation. */
  assistDays?: Map<number, AssistHalf>;
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
  /** Whether clicking a day cell adds a job (false on read-only boards). */
  canAddJob: boolean;
  onCellClick: (day: Date) => void;
  onJobClick: (line: ScheduleLine) => void;
  onResize: (line: ScheduleLine, newHours: number) => Promise<void>;
  /** Right-click card actions (omitted on read-only boards). */
  onDuplicateLine?: (line: ScheduleLine) => void;
  onDeleteLine?: (line: ScheduleLine) => void;
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
  canAddJob,
  onCellClick,
  onJobClick,
  onResize,
  onDuplicateLine,
  onDeleteLine,
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
    <div
      className={"employee-row" + (emp.isDepartmentLane ? " employee-row--lane" : "")}
      style={{ minHeight: rowMinHeight }}
    >
      <div
        className={
          "employee-row__name" +
          (emp.isDepartmentLane ? " employee-row__name--lane" : "") +
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
          {emp.isDepartmentLane ? <GroupIcon /> : null}
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
          const weekend = isWeekend(day);
          // Assist: "full" blocks the whole day (greyed, no drop); "am"/"pm"
          // tints half the cell but still lets a production job land the other
          // half, so those days aren't blocked.
          const assistHalf = assistDays?.get(i);
          const assistFull = assistHalf === "full";
          const assistPartial = assistHalf === "am" || assistHalf === "pm";
          // A day cell is addable whether or not it already has cards — clicking
          // the empty space under/around a card adds another job to that day
          // (clicks that land ON a card stop propagation and open the editor
          // instead). Blocked only on read-only boards and full-day assist.
          const addable = canAddJob && !assistFull;
          return (
            <div
              key={i}
              className={
                `day-cell${weekend ? " day-cell--weekend" : ""}` +
                `${addable ? " day-cell--addable" : ""}` +
                `${dropHoverIdx === i ? " day-cell--drop-target" : ""}` +
                `${assistFull ? " day-cell--assist" : ""}` +
                `${assistPartial ? ` day-cell--assist-${assistHalf}` : ""}`
              }
              onDragOver={assistFull ? undefined : handleStripDragOver}
              onDrop={assistFull ? undefined : handleStripDrop}
              onClick={() => {
                if (addable) onCellClick(day);
              }}
            >
              {assistFull && <span className="day-cell__assist">Installation</span>}
              {assistPartial && (
                <span className="day-cell__assist day-cell__assist--half">
                  Install {assistHalf === "am" ? "AM" : "PM"}
                </span>
              )}
            </div>
          );
        })}

        {cards.map((card) => (
          <GanttCard
            key={card.line.id}
            card={card}
            kind={kind}
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
            onDuplicate={onDuplicateLine ? () => onDuplicateLine(card.line) : undefined}
            onDelete={onDeleteLine ? () => onDeleteLine(card.line) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

interface GanttCardProps {
  card: CardLayout;
  kind: ScheduleKind;
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
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function GanttCard({
  card,
  kind,
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
  onDuplicate,
  onDelete,
}: GanttCardProps) {
  const { line, startIdx, spanDays, overflowLeft, overflowRight, lane } = card;

  // A job with a Red (drop-dead install) date gets a pulsing red outline on
  // every schedule. Keyed by job number, so it shows on all of the job's cards.
  const hasRedDate = useJobScheduleStore((s) => !!(line.jobNo && s.byJob[line.jobNo]?.redDate));

  // A completed step recedes its card (muted + check) so the board reads as
  // progress. The card's step = its production dept, or Install on the install board.
  const stepDone = useJobDeptCompletionStore((s) => {
    if (!line.jobNo || line.isCustom) return false;
    const k = cardStepKey(kind, department?.name);
    return !!(k && s.byJob[line.jobNo]?.[k]);
  });

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
      className={`gantt-card${overflowLeft ? " gantt-card--overflow-left" : ""}${overflowRight ? " gantt-card--overflow-right" : ""}${highlighted ? " gantt-card--highlighted" : ""}${dragging ? " gantt-card--dragging" : ""}${hasRedDate ? " gantt-card--reddate" : ""}${stepDone ? " gantt-card--done" : ""}`}
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
        onDuplicate={onDuplicate}
        onDelete={onDelete}
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
