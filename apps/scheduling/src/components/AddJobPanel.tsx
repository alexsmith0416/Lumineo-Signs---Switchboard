import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useJobSearch, type JobSearchResult } from "../hooks/useJobSearch";
import {
  departmentNameForLine,
  isInstallResource,
  isProductionResource,
  resolveDepartmentId,
} from "../services/planning-line-mapping";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import { proposeSchedule } from "../services/auto-schedule";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { type CustomCardPreset } from "../data/custom-card-presets";
import {
  builtInPresets,
  newPresetId,
  presetKindFor,
  toApplyShape,
  type SavedCardPreset,
} from "../services/custom-card-data";
import { useCardPresetsStore } from "../store/card-presets-store";
import { makeLaneEmployee } from "../services/department-lane";
import { useLoadsStore } from "../shipping/loads-store";
import { shipmentSummary } from "../shipping/types";
import type { ScheduleLine } from "../engine/types";
import GroupCardBody from "./GroupCardBody";
import { encodeGroup, groupColorFor, type GroupMember } from "../services/group-card";

const SHIPMENT_CARD_BG = "#2D6CDF";
const SHIPMENT_CARD_FG = "#ffffff";

/** BC promised dates arrive as a string that may be empty ("") or unparseable
 *  for a job with no promised date. Convert to a Date only when valid — an
 *  Invalid Date crashes date-fns format() (blanking the whole panel) and
 *  poisons the scheduling engine. Callers treat null as "no due date". */
function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Pick black or white text for a given background so a swatch-chosen color
 *  stays legible (relative luminance threshold). */
function readableText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#1a1d23";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1a1d23" : "#ffffff";
}

interface AddJobPanelProps {
  onClose: () => void;
  initialStart?: Date;
  initialEmployeeId?: string;
  /** When set, the job is scheduled to the WHOLE department (team lane) rather
   *  than one employee — creates department-wide lines. Production only. */
  initialDepartmentId?: string;
  useStore?: UseScheduleStore;
  /** Open directly on a card kind (e.g. "group" for the "Add group card" flow). */
  initialKind?: CardKind;
}

type Mode = "single" | "multi" | "auto" | "custom-task";
type CardKind = "bc" | "custom" | "group";

export default function AddJobPanel({
  onClose,
  initialStart,
  initialEmployeeId,
  initialDepartmentId,
  useStore = useScheduleStore,
  initialKind = "bc",
}: AddJobPanelProps) {
  const { query, setQuery, results, loading } = useJobSearch();
  const [selected, setSelected] = useState<JobSearchResult | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  // Selection is tracked by ROW INDEX into visibleLines, NOT by lineNo: BC gives
  // several planning lines the same lineNo, so keying on lineNo would select /
  // commit every line that shares it. The row index is unique per task.
  const [checkedIdx, setCheckedIdx] = useState<Set<number>>(new Set());
  const [singleIdx, setSingleIdx] = useState<number | null>(null);
  // Custom task on a BC job — for jobs that have no BC planning line and so
  // otherwise can't be scheduled.
  const [customTaskDesc, setCustomTaskDesc] = useState("");
  const [customTaskHours, setCustomTaskHours] = useState(8);
  const [customTaskEmployeeId, setCustomTaskEmployeeId] = useState<string>(initialEmployeeId ?? "");

  // Custom card state
  const [cardKind, setCardKind] = useState<CardKind>(initialKind);
  const [customTitle, setCustomTitle] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [customBg, setCustomBg] = useState("#CCCCCC");
  const [customFg, setCustomFg] = useState("#1a1d23");
  const [customHours, setCustomHours] = useState(8);
  const [customEmployeeId, setCustomEmployeeId] = useState<string>(initialEmployeeId ?? "");
  const [customLocked, setCustomLocked] = useState(false);
  const [customApplyAll, setCustomApplyAll] = useState(false);
  const [customScope, setCustomScope] = useState<"resource" | "department" | "all">("resource");
  const [customDeptId, setCustomDeptId] = useState<string>("");
  const [customShipmentLoadId, setCustomShipmentLoadId] = useState<string>("");
  // Installation only: mark this card as the job's FINAL install — its day sets
  // the job's scheduled install date.
  const [finalInstall, setFinalInstall] = useState(false);

  // Group card state (a container card holding member BC jobs).
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const kind = useStore((s) => s.dataSource.kind);
  const loads = useLoadsStore((s) => s.loads);
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);

  // Saved custom-card presets for this board family (production / installation).
  const presetKind = presetKindFor(kind);
  const savedPresets = useCardPresetsStore((s) => s.byKind[presetKind]);
  const loadPresets = useCardPresetsStore((s) => s.load);
  const savePreset = useCardPresetsStore((s) => s.save);
  const removePreset = useCardPresetsStore((s) => s.remove);
  // Dropdown selection, encoded as "saved:<id>" | "builtin:<id>" | "".
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("");
  useEffect(() => {
    void loadPresets(presetKind);
  }, [loadPresets, presetKind]);

  // Card-color palette = this board's Department (production) / Location
  // (installation) colors, so a custom card can match the group it sits under.
  const paletteSwatches = useMemo(
    () =>
      [...departments.values()]
        .sort((a, b) => a.flowOrder - b.flowOrder)
        .map((d) => ({ id: d.id, name: d.name, color: d.color })),
    [departments],
  );

  // Department-wide ("team") target: the job is scheduled to the whole
  // department's shared lane rather than one person. `laneEmp` is the synthetic
  // resource that owns that lane; `ctxEmployees` includes it so the engine can
  // compute end times for team lines.
  const laneEmp = useMemo(() => {
    if (!initialDepartmentId) return null;
    const d = departments.get(initialDepartmentId);
    return d ? makeLaneEmployee(d) : null;
  }, [initialDepartmentId, departments]);
  const isTeam = !!laneEmp;
  const ctxEmployees = useMemo(
    () => (laneEmp ? new Map([...employees, [laneEmp.id, laneEmp]]) : employees),
    [employees, laneEmp],
  );

  // Resolve each line's department to an ACTUAL loaded department id: the BC
  // resource code (or description) gives a canonical dept name, which we match
  // against the loaded departments by name. Live departments are keyed by GUID,
  // so the mapping's slug can't be looked up directly — this bridges that.
  const resolvedLines = useMemo(
    () =>
      !selected
        ? []
        : selected.mappedLines.map((l) => ({
            ...l,
            departmentId: resolveDepartmentId(
              departmentNameForLine(l.resourceNo, l.description),
              departments,
            ),
          })),
    [selected, departments],
  );

  // Split by this calendar's kind using the BC resource code (crfdf_no):
  // Production shows the 2000-band shop labor; Installation (and other kinds)
  // show everything outside that band, minus non-schedulable resources
  // (e.g. 1110 Sketch Resource labor). All downstream selection/commit works
  // off this filtered list.
  const visibleLines = useMemo(
    () =>
      resolvedLines.filter((l) =>
        kind === "production" ? isProductionResource(l.resourceNo) : isInstallResource(l.resourceNo),
      ),
    [resolvedLines, kind],
  );
  const scheduleState = useStore((s) => s.schedule);
  const workHoursState = useStore((s) => s.workHours);
  const overtimeState = useStore((s) => s.overtime);
  const addScheduleLine = useStore((s) => s.addScheduleLine);

  const targetIdx = useMemo(() => {
    if (!selected) return new Set<number>();
    if (mode === "single") {
      return new Set<number>(singleIdx !== null ? [singleIdx] : []);
    }
    if (mode === "multi") return new Set<number>(checkedIdx);
    if (mode === "auto") return new Set<number>(visibleLines.map((_, i) => i));
    return new Set<number>(); // custom-task: no planning lines involved
  }, [selected, visibleLines, mode, singleIdx, checkedIdx]);

  const predictedSlots = useMemo(() => {
    if (!selected || targetIdx.size === 0) return null;
    const ctx = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const targets = visibleLines.filter((_, i) => targetIdx.has(i));
    const preferred =
      initialEmployeeId && mode !== "auto"
        ? Object.fromEntries(
            [...employees.values()]
              .filter((e) => e.id === initialEmployeeId)
              .map((e) => [e.departmentId, e.id]),
          )
        : undefined;
    return proposeSchedule(
      {
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        promisedDate: safeDate(selected.job.promisedDate),
      },
      targets,
      ctx,
      { earliestStart: initialStart, preferredEmployeeIds: preferred },
    );
  }, [selected, targetIdx, employees, departments, scheduleState, workHoursState, overtimeState, initialStart, initialEmployeeId, mode]);

  const commit = async () => {
    if (!selected) return;

    const targets = visibleLines.filter((_, i) => targetIdx.has(i));

    if (targets.length === 0) return;

    const ctxForEngine = {
      employees: ctxEmployees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };

    // Cell-click flow (single/multi mode with a preset employee OR a team
    // target): respect the clicked resource verbatim. Skip proposeSchedule's
    // department matching — useful for installation/shipping where the
    // resource's "department" is a base location, and for team jobs where the
    // target is the whole department lane.
    if ((initialEmployeeId || isTeam) && mode !== "auto") {
      const emp = isTeam ? laneEmp! : employees.get(initialEmployeeId!);
      if (!emp) return;

      let cursor = initialStart ? new Date(initialStart) : new Date();
      if (cursor.getHours() < 8) cursor.setHours(8, 0, 0, 0);

      // A job's selected tasks belong on ONE card — the task names stack under
      // the job header and their hours sum. Since a cell click targets a single
      // employee, Production merges here just like Installation (previously
      // Production made a separate card per task).
      const first = targets[0]!;
      const mergedLine: ScheduleLine = {
        id: "tmp",
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        jobDescription: selected.job.description,
        planningLineDescription: targets.map((t) => t.description).join("\n"),
        startDateTime: cursor,
        endDateTime: cursor,
        estimatedHours: targets.reduce((sum, t) => sum + t.estimatedHours, 0),
        overrideHours: null,
        employeeId: emp.id,
        departmentId: emp.departmentId,
        departmentWide: isTeam || undefined,
        customerDueDate: safeDate(selected.job.promisedDate),
        isLocked: false,
        jobSequence: first.lineNo,
        installZip: selected.job.shipToZip || null,
        ...(kind === "installation" && finalInstall ? { finalInstall: true } : {}),
      };
      const end = calculateEndTime(cursor, effectiveHours(mergedLine, emp), emp, ctxForEngine);
      await addScheduleLine({
        ...mergedLine,
        id: `line-${selected.job.jobNo}-${first.lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        endDateTime: end,
      });
      onClose();
      return;
    }

    // Auto-mode (or no preset employee): use the proposed-schedule output.
    if (!predictedSlots) return;
    const validSlots = predictedSlots.filter((s) => s.employeeId && s.departmentId);

    // Merge a job's tasks that land on the SAME employee + department into one
    // card (summed hours, stacked task names). Installation lands a job's tasks
    // together, so they collapse to one card; Production tasks that route to
    // different departments still get a card each.
    const groups = new Map<string, typeof validSlots>();
    for (const slot of validSlots) {
      const key = `${slot.employeeId}|${slot.departmentId}`;
      const g = groups.get(key);
      if (g) g.push(slot);
      else groups.set(key, [slot]);
    }
    for (const group of groups.values()) {
      const first = group[0]!;
      const emp = employees.get(first.employeeId!);
      const mergedLine: ScheduleLine = {
        id: "tmp",
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        jobDescription: selected.job.description,
        planningLineDescription: group.map((s) => s.description).join("\n"),
        startDateTime: first.start,
        endDateTime: first.start,
        estimatedHours: group.reduce((sum, s) => sum + s.estimatedHours, 0),
        overrideHours: null,
        employeeId: first.employeeId!,
        departmentId: first.departmentId!,
        customerDueDate: safeDate(selected.job.promisedDate),
        isLocked: false,
        jobSequence: first.lineNo,
        installZip: selected.job.shipToZip || null,
        ...(kind === "installation" && finalInstall ? { finalInstall: true } : {}),
      };
      const end = emp
        ? calculateEndTime(first.start, effectiveHours(mergedLine, emp), emp, ctxForEngine)
        : first.end;
      await addScheduleLine({
        ...mergedLine,
        id: `line-${selected.job.jobNo}-${first.lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        endDateTime: end,
      });
    }
    onClose();
  };

  // Schedule a user-entered task on the selected BC job (job keeps its number /
  // customer / ship-to; the task text + hours come from the form). Lets a job
  // with no BC planning line still be put on the board.
  const commitCustomTask = async () => {
    if (!selected) return;

    const emp = isTeam
      ? laneEmp!
      : customTaskEmployeeId
        ? employees.get(customTaskEmployeeId)
        : undefined;
    const hours = Number(customTaskHours);
    if (!emp || !customTaskDesc.trim() || Number.isNaN(hours) || hours <= 0) return;

    let cursor = initialStart ? new Date(initialStart) : new Date();
    if (cursor.getHours() < 8) cursor.setHours(8, 0, 0, 0);

    const ctxForEngine = {
      employees: ctxEmployees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const base: ScheduleLine = {
      id: "tmp",
      jobNo: selected.job.jobNo,
      customerName: selected.job.customerName,
      jobDescription: selected.job.description,
      planningLineDescription: customTaskDesc.trim(),
      startDateTime: cursor,
      endDateTime: cursor,
      estimatedHours: hours,
      overrideHours: null,
      employeeId: emp.id,
      departmentId: emp.departmentId,
      departmentWide: isTeam || undefined,
      customerDueDate: safeDate(selected.job.promisedDate),
      isLocked: false,
      jobSequence: 0,
      installZip: selected.job.shipToZip || null,
      ...(kind === "installation" && finalInstall ? { finalInstall: true } : {}),
    };
    const end = calculateEndTime(cursor, effectiveHours(base, emp), emp, ctxForEngine);
    await addScheduleLine({
      ...base,
      id: `line-${selected.job.jobNo}-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      endDateTime: end,
    });
    onClose();
  };

  const applyPreset = (preset: CustomCardPreset) => {
    setCustomTitle(preset.label);
    setCustomBg(preset.bgColor);
    setCustomFg(preset.textColor);
    setCustomHours(preset.defaultHours);
    setCustomLocked(preset.lockByDefault ?? false);
    if (preset.applyAllByDefault) {
      setCustomScope("all");
      setCustomApplyAll(true);
    }
  };

  // Pick a saved/built-in preset from the dropdown ("saved:<id>" | "builtin:<id>").
  const onPickPreset = (key: string) => {
    setSelectedPresetKey(key);
    if (!key) return;
    const [src, id] = key.split(":");
    const preset =
      src === "saved"
        ? savedPresets.find((p) => p.id === id)
        : builtInPresets().find((p) => p.id === id);
    if (preset) applyPreset(toApplyShape(preset));
  };

  // Save the current custom-card fields as a reusable preset for this board.
  const onSaveCurrentPreset = () => {
    const label = customTitle.trim();
    if (!label) return;
    const preset: SavedCardPreset = {
      id: newPresetId(),
      kind: presetKind,
      label,
      bgColor: customBg,
      textColor: customFg,
      defaultHours: customHours,
      lockByDefault: customLocked,
      applyAllByDefault: customScope === "all" || customApplyAll,
      sortOrder: savedPresets.length,
    };
    void savePreset(preset);
    setSelectedPresetKey(`saved:${preset.id}`);
  };

  const onDeleteSelectedPreset = () => {
    if (!selectedPresetKey.startsWith("saved:")) return;
    void removePreset(selectedPresetKey.slice("saved:".length), presetKind);
    setSelectedPresetKey("");
  };

  const commitCustom = async () => {
    if (!customTitle) return;
    if (customScope === "resource" && !customEmployeeId) return;
    if (customScope === "department" && !customDeptId) return;

    const ctxForEngine = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };

    let start = initialStart ? new Date(initialStart) : new Date();
    if (start.getHours() < 8) start.setHours(8, 0, 0, 0);

    const targets =
      customScope === "all" || customApplyAll
        ? [...employees.values()]
        : customScope === "department"
          ? [...employees.values()].filter((e) => e.departmentId === customDeptId)
          : (() => {
              const emp = employees.get(customEmployeeId);
              return emp ? [emp] : [];
            })();

    for (const emp of targets) {
      const tempLine: ScheduleLine = {
        id: "tmp",
        jobNo: customTitle,
        customerName: customTitle,
        planningLineDescription: customNotes,
        startDateTime: start,
        endDateTime: start,
        estimatedHours: customHours,
        overrideHours: null,
        employeeId: emp.id,
        departmentId: emp.departmentId,
        customerDueDate: null,
        isLocked: customLocked,
        jobSequence: 0,
        isCustom: true,
        customColor: customBg,
        customTextColor: customFg,
        shipmentLoadId: customShipmentLoadId || null,
      };
      const end = calculateEndTime(
        start,
        effectiveHours(tempLine, emp),
        emp,
        ctxForEngine,
      );

      await addScheduleLine({
        ...tempLine,
        id: `custom-${emp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        endDateTime: end,
      });
    }
    onClose();
  };

  // Create a grouped job card — a container line on the board (one employee's day
  // or a whole department) holding member BC jobs. Auto-colors to its
  // department/location; resizable + movable like any card.
  const commitGroup = async () => {
    const t = groupTitle.trim();
    if (!t) return;
    const emp = isTeam ? laneEmp! : initialEmployeeId ? employees.get(initialEmployeeId) : undefined;
    const target = emp ?? [...employees.values()][0];
    if (!target) return;
    const deptId = isTeam ? initialDepartmentId! : target.departmentId;
    const color = groupColorFor(departments.get(deptId));

    let start = initialStart ? new Date(initialStart) : new Date();
    if (start.getHours() < 8) start.setHours(8, 0, 0, 0);

    const ctxForEngine = {
      employees: ctxEmployees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const tempLine: ScheduleLine = {
      id: "tmp",
      jobNo: t,
      customerName: t,
      planningLineDescription: encodeGroup({
        title: t,
        description: groupDescription.trim(),
        members: groupMembers,
      }),
      startDateTime: start,
      endDateTime: start,
      estimatedHours: 8, // one-day default width; resizable on the board
      overrideHours: null,
      employeeId: target.id,
      departmentId: deptId,
      departmentWide: isTeam || undefined,
      customerDueDate: null,
      isLocked: false,
      jobSequence: 0,
      isCustom: true,
      customColor: color.bg,
      customTextColor: color.text,
    };
    const end = calculateEndTime(start, effectiveHours(tempLine, target), target, ctxForEngine);
    await addScheduleLine({
      ...tempLine,
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      endDateTime: end,
    });
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          {cardKind === "group" ? "Add Group Card" : isTeam ? "Add Team Job" : "Add Job"}
        </div>
        {isTeam && (
          <div style={{ padding: "0 12px 8px", fontSize: 11, color: "var(--text-secondary)" }}>
            Scheduling to the whole{" "}
            <strong>{departments.get(initialDepartmentId!)?.name ?? "department"}</strong>{" "}
            team — every member sees this on their schedule.
          </div>
        )}

        {/* Kind toggle: BC Job (search) · Custom Card (block out time) · Group
            card (container of jobs). Team adds are BC-only; a group added via the
            banner opens straight in group mode (no toggle needed). */}
        {!isTeam && (
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 10,
            background: "var(--bg-secondary)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            className={cardKind === "bc" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1, padding: "8px 12px" }}
            onClick={() => setCardKind("bc")}
          >
            BC Job
          </button>
          <button
            type="button"
            className={cardKind === "custom" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1, padding: "8px 12px" }}
            onClick={() => setCardKind("custom")}
          >
            Custom Card
          </button>
          <button
            type="button"
            className={cardKind === "group" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1, padding: "8px 12px" }}
            onClick={() => setCardKind("group")}
          >
            Group Card
          </button>
        </div>
        )}

        <div className="slide-over__body">
        {cardKind === "bc" && (
        <>
        <div style={{ padding: 12 }}>
          <input
            className="form-field__input"
            style={{ width: "100%", borderRadius: 4 }}
            placeholder="Search BC job number (e.g. J103101 or 103101)…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setSingleIdx(null);
              setCheckedIdx(new Set());
            }}
            autoFocus
          />
          {loading && <div className="loading">Searching…</div>}
          {!selected && results.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
              {results.map((r) => {
                const due = safeDate(r.job.promisedDate);
                return (
                  <li key={r.job.jobNo} style={{ marginBottom: 4 }}>
                    <button
                      className="btn-secondary"
                      style={{ width: "100%", textAlign: "left" }}
                      onClick={() => {
                        setSelected(r);
                        setSingleIdx(null);
                        setCheckedIdx(new Set());
                      }}
                    >
                      <strong>{r.job.jobNo}</strong> — {r.job.customerName}
                      {due ? ` · due ${format(due, "MMM d")}` : ""}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <>
            <div className="section-title">{selected.job.jobNo} · {selected.job.customerName}</div>
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button
                  className={mode === "single" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("single")}
                >
                  Single
                </button>
                <button
                  className={mode === "multi" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("multi")}
                >
                  Multi
                </button>
                {!isTeam && (
                  <button
                    className={mode === "auto" ? "btn-primary" : "btn-secondary"}
                    style={{ flex: 1 }}
                    onClick={() => setMode("auto")}
                  >
                    Auto
                  </button>
                )}
                <button
                  className={mode === "custom-task" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("custom-task")}
                >
                  Custom task
                </button>
              </div>

              {mode === "custom-task" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Add a task to this job manually — use this when the job has no BC
                    planning line to schedule.
                  </div>
                  <div>
                    <div className="form-field__label">Task description</div>
                    <textarea
                      className="form-field__input"
                      rows={2}
                      value={customTaskDesc}
                      onChange={(e) => setCustomTaskDesc(e.target.value)}
                      placeholder="e.g. Field measure / install labor"
                      style={{ resize: "vertical", fontFamily: "inherit", width: "100%" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div className="form-field__label">Hours</div>
                      <input
                        className="form-field__input"
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={customTaskHours}
                        onChange={(e) => setCustomTaskHours(Number(e.target.value))}
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <div className="form-field__label">
                        {isTeam ? "Assigned to" : "Employee"}
                      </div>
                      {isTeam ? (
                        <div
                          className="form-field__input"
                          style={{ width: "100%", color: "var(--text-secondary)" }}
                        >
                          Whole department
                        </div>
                      ) : (
                        <select
                          className="form-field__select"
                          value={customTaskEmployeeId}
                          onChange={(e) => setCustomTaskEmployeeId(e.target.value)}
                          style={{ width: "100%" }}
                        >
                          <option value="">Select…</option>
                          {[...employees.values()].map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visibleLines.length === 0 && (
                  <li style={{ fontSize: 11, color: "var(--text-secondary)", padding: 8 }}>
                    No BC planning lines for this job. Use “Custom task” to add one.
                  </li>
                )}
                {visibleLines.map((line, idx) => {
                  const dept = line.departmentId ? departments.get(line.departmentId) : undefined;
                  const isCurrent = targetIdx.has(idx);
                  const proposedSlot = isCurrent
                    ? predictedSlots?.find((p) => p.lineNo === line.lineNo)
                    : undefined;
                  return (
                    <li
                      key={idx}
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        marginBottom: 6,
                        background: isCurrent ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                        cursor: mode === "auto" ? "default" : "pointer",
                      }}
                      onClick={() => {
                        if (mode === "single") setSingleIdx(idx);
                        else if (mode === "multi") {
                          const next = new Set(checkedIdx);
                          if (next.has(idx)) next.delete(idx);
                          else next.add(idx);
                          setCheckedIdx(next);
                        }
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {line.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {line.estimatedHours}h · {dept?.name ?? "unmapped"}
                      </div>
                      {isTeam ? (
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                          → Whole department
                          {initialStart ? ` on ${format(initialStart, "EEE MMM d")}` : ""}
                        </div>
                      ) : (
                        proposedSlot && proposedSlot.employeeId && (
                          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                            →{" "}
                            {employees.get(
                              initialEmployeeId && mode !== "auto"
                                ? initialEmployeeId
                                : proposedSlot.employeeId,
                            )?.name ?? proposedSlot.employeeId}{" "}
                            on {format(proposedSlot.start, "EEE MMM d")}{" "}
                            {format(proposedSlot.start, "HH:mm")}
                          </div>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
          </>
        )}
        </>
        )}

        {cardKind === "custom" && (
          <div style={{ padding: 12 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Saved cards
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <select
                className="form-field__select"
                style={{ flex: 1 }}
                value={selectedPresetKey}
                onChange={(e) => onPickPreset(e.target.value)}
              >
                <option value="">Choose a saved or built-in card…</option>
                {savedPresets.length > 0 && (
                  <optgroup
                    label={presetKind === "production" ? "Saved · Production" : "Saved · Installation"}
                  >
                    {savedPresets.map((p) => (
                      <option key={p.id} value={`saved:${p.id}`}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Built-in">
                  {builtInPresets().map((p) => (
                    <option key={p.id} value={`builtin:${p.id}`}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              {selectedPresetKey.startsWith("saved:") && (
                <button
                  type="button"
                  className="btn-secondary"
                  title="Delete this saved card"
                  onClick={onDeleteSelectedPreset}
                  style={{ padding: "0 12px" }}
                >
                  ✕
                </button>
              )}
            </div>

            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Build your own
            </div>

            {kind === "installation" && (
              <div className="form-field">
                <div className="form-field__label">Shipment load (optional)</div>
                <select
                  className="form-field__select"
                  value={customShipmentLoadId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCustomShipmentLoadId(id);
                    const load = loads.find((l) => l.id === id);
                    if (load) {
                      setCustomTitle(load.name);
                      setCustomNotes(shipmentSummary(load));
                      setCustomBg(SHIPMENT_CARD_BG);
                      setCustomFg(SHIPMENT_CARD_FG);
                    }
                  }}
                >
                  <option value="">— None (manual card) —</option>
                  {/* Show every load, not just loaded/delivered ones — a freshly
                      made load is "planned" and still needs to be schedulable. */}
                  {[...loads]
                    .sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime())
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} · {l.items.length} item{l.items.length === 1 ? "" : "s"} · {l.status}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="form-field">
              <div className="form-field__label">Title</div>
              <input
                className="form-field__input"
                placeholder="e.g. PTO, Training, etc."
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>

            <div className="form-field">
              <div className="form-field__label">Color</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  background: "var(--input-bg)",
                }}
              >
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  style={{ width: 40, height: 28, border: "none", cursor: "pointer" }}
                />
                <div
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: customBg,
                    color: customFg,
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {customTitle || "Preview"}
                </div>
                <input
                  type="color"
                  value={customFg}
                  onChange={(e) => setCustomFg(e.target.value)}
                  style={{ width: 40, height: 28, border: "none", cursor: "pointer" }}
                  title="Text color"
                />
              </div>
              {paletteSwatches.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      marginTop: 6,
                      marginBottom: 4,
                    }}
                  >
                    {presetKind === "production" ? "Department colors" : "Location colors"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {paletteSwatches.map((sw) => (
                      <button
                        key={sw.id}
                        type="button"
                        title={sw.name}
                        onClick={() => {
                          setCustomBg(sw.color);
                          setCustomFg(readableText(sw.color));
                        }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          cursor: "pointer",
                          background: sw.color,
                          border:
                            customBg.toLowerCase() === sw.color.toLowerCase()
                              ? "2px solid var(--lumineo-navy)"
                              : "1px solid var(--border)",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="form-field">
              <div className="form-field__label">Hours</div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "4px 8px",
                  background: "var(--input-bg)",
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  className="form-field__input"
                  style={{ flex: "0 0 80px", padding: "4px 6px" }}
                  value={customHours}
                  onChange={(e) => setCustomHours(Number(e.target.value) || 0)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => setCustomHours(8)}
                >
                  Full day (8h)
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => setCustomHours(40)}
                >
                  Full week (40h)
                </button>
              </div>
            </div>

            <div className="form-field">
              <div className="form-field__label">Scope</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "6px 10px",
                  background: "var(--input-bg)",
                  fontSize: 12,
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="custom-scope"
                    checked={customScope === "resource"}
                    onChange={() => setCustomScope("resource")}
                  />
                  <span>One resource</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="custom-scope"
                    checked={customScope === "department"}
                    onChange={() => setCustomScope("department")}
                  />
                  <span>Entire department</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="custom-scope"
                    checked={customScope === "all"}
                    onChange={() => setCustomScope("all")}
                  />
                  <span>
                    All {employees.size} resources{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>(e.g. shop-wide Holiday)</span>
                  </span>
                </label>
              </div>
            </div>

            {customScope === "resource" && (
              <div className="form-field">
                <div className="form-field__label">Resource</div>
                <select
                  className="form-field__select"
                  value={customEmployeeId}
                  onChange={(e) => setCustomEmployeeId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {[...employees.values()].map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {customScope === "department" && (
              <div className="form-field">
                <div className="form-field__label">Department</div>
                <select
                  className="form-field__select"
                  value={customDeptId}
                  onChange={(e) => setCustomDeptId(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {[...departments.values()]
                    .sort((a, b) => a.flowOrder - b.flowOrder)
                    .map((d) => {
                      const count = [...employees.values()].filter(
                        (e) => e.departmentId === d.id,
                      ).length;
                      return (
                        <option key={d.id} value={d.id}>
                          {d.name} ({count})
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            <div className="form-field">
              <div className="form-field__label">Lock</div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  background: "var(--input-bg)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={customLocked}
                  onChange={(e) => setCustomLocked(e.target.checked)}
                />
                <span>
                  🔒 Lock — cascade flows around this card{" "}
                  <span style={{ color: "var(--text-tertiary)" }}>
                    (recommended for PTO / Holiday)
                  </span>
                </span>
              </label>
            </div>

            <div className="form-field">
              <div className="form-field__label">Notes</div>
              <input
                className="form-field__input"
                placeholder="(optional)"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{ width: "100%", marginTop: 4 }}
              disabled={!customTitle.trim()}
              onClick={onSaveCurrentPreset}
              title="Save these settings as a reusable card for this board"
            >
              ＋ Save as reusable card
            </button>

            {initialStart && (
              <div style={{ marginTop: 8, color: "var(--text-tertiary)", fontSize: 11 }}>
                Starts {format(initialStart, "EEE MMM d HH:mm")}
              </div>
            )}
          </div>
        )}

        {cardKind === "group" && (
          <>
            <div style={{ padding: "0 12px", fontSize: 11, color: "var(--text-secondary)" }}>
              A container card that holds a list of BC jobs. It sits on{" "}
              {isTeam ? (
                <>
                  the whole <strong>{departments.get(initialDepartmentId!)?.name ?? "department"}</strong>
                </>
              ) : (
                "this day"
              )}
              , auto-colors to its department/location, and can be moved &amp; resized.
            </div>
            <GroupCardBody
              title={groupTitle}
              setTitle={setGroupTitle}
              description={groupDescription}
              setDescription={setGroupDescription}
              members={groupMembers}
              onAddMember={(m) => setGroupMembers((prev) => [...prev, m])}
              onRemoveMember={(id) => setGroupMembers((prev) => prev.filter((x) => x.id !== id))}
              useStore={useStore}
            />
          </>
        )}

        </div>

        {kind === "installation" && cardKind === "bc" && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderTop: "1px solid var(--border)",
              fontSize: 12,
              cursor: "pointer",
            }}
            title="This card's day sets the job's scheduled install date"
          >
            <input
              type="checkbox"
              checked={finalInstall}
              onChange={(e) => setFinalInstall(e.target.checked)}
            />
            <span>
              <strong>Final install</strong> — this card&apos;s day sets the job&apos;s scheduled install date
            </span>
          </label>
        )}

        <div
          className="slide-over__footer"
          style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}
        >
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={
              cardKind === "bc"
                ? mode === "custom-task"
                  ? !selected ||
                    !customTaskDesc.trim() ||
                    (!isTeam && !customTaskEmployeeId) ||
                    Number(customTaskHours) <= 0
                  : !selected ||
                    (mode === "single" && singleIdx === null) ||
                    (mode === "multi" && checkedIdx.size === 0)
                : cardKind === "group"
                  ? !groupTitle.trim()
                  : !customTitle ||
                    (customScope === "resource" && !customEmployeeId) ||
                    (customScope === "department" && !customDeptId) ||
                    customHours <= 0
            }
            onClick={
              cardKind === "bc"
                ? mode === "custom-task"
                  ? commitCustomTask
                  : commit
                : cardKind === "group"
                  ? commitGroup
                  : commitCustom
            }
          >
            {cardKind === "group" ? "Create group card" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
