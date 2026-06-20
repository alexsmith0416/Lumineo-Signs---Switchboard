import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useJobSearch, type JobSearchResult } from "../hooks/useJobSearch";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import { proposeSchedule } from "../services/auto-schedule";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { CUSTOM_CARD_PRESETS, type CustomCardPreset } from "../data/custom-card-presets";
import type { ScheduleLine } from "../engine/types";

interface AddJobPanelProps {
  onClose: () => void;
  initialStart?: Date;
  initialEmployeeId?: string;
  useStore?: UseScheduleStore;
}

type Mode = "single" | "multi" | "auto";
type CardKind = "bc" | "custom";

export default function AddJobPanel({
  onClose,
  initialStart,
  initialEmployeeId,
  useStore = useScheduleStore,
}: AddJobPanelProps) {
  const { query, setQuery, results, loading } = useJobSearch();
  const [selected, setSelected] = useState<JobSearchResult | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [checkedLines, setCheckedLines] = useState<Set<number>>(new Set());
  const [singleLineNo, setSingleLineNo] = useState<number | null>(null);

  // BC Add Job — Canvas-mirror flow state. The supervisor explicitly
  // picks one Resource-type planning line, then the employee (filtered to
  // the auto-detected department), then the start date. Mirrors the
  // Production Scheduling screen in the Power Apps Canvas app.
  const [bcEmployeeId, setBcEmployeeId] = useState<string>(initialEmployeeId ?? "");
  const [bcStartDate, setBcStartDate] = useState<string>(() => {
    const d = initialStart ?? new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Custom card state
  const [cardKind, setCardKind] = useState<CardKind>("bc");
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

  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);
  const scheduleState = useStore((s) => s.schedule);
  const workHoursState = useStore((s) => s.workHours);
  const overtimeState = useStore((s) => s.overtime);
  const addScheduleLine = useStore((s) => s.addScheduleLine);

  const targetLineNos = useMemo(() => {
    if (!selected) return new Set<number>();
    if (mode === "single") {
      return new Set<number>(singleLineNo !== null ? [singleLineNo] : []);
    }
    if (mode === "multi") return new Set<number>(checkedLines);
    return new Set<number>(selected.mappedLines.map((l) => l.lineNo));
  }, [selected, mode, singleLineNo, checkedLines]);

  const predictedSlots = useMemo(() => {
    if (!selected || targetLineNos.size === 0) return null;
    const ctx = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const targets = selected.mappedLines.filter((l) => targetLineNos.has(l.lineNo));
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
        promisedDate: new Date(selected.job.promisedDate),
      },
      targets,
      ctx,
      { earliestStart: initialStart, preferredEmployeeIds: preferred },
    );
  }, [selected, targetLineNos, employees, departments, scheduleState, workHoursState, overtimeState, initialStart, initialEmployeeId, mode]);

  const commit = async () => {
    if (!selected) return;

    const targets =
      mode === "single" && singleLineNo !== null
        ? selected.mappedLines.filter((l) => l.lineNo === singleLineNo)
        : mode === "multi"
          ? selected.mappedLines.filter((l) => checkedLines.has(l.lineNo))
          : selected.mappedLines;

    if (targets.length === 0) return;

    const ctxForEngine = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };

    // Cell-click flow (single/multi mode with a preset employee): respect
    // the clicked resource verbatim. Skip proposeSchedule's department
    // matching — useful for installation/shipping where the resource's
    // "department" is a base location, not a flow step that maps from a BC
    // planning-line keyword.
    if (initialEmployeeId && mode !== "auto") {
      const emp = employees.get(initialEmployeeId);
      if (!emp) return;

      let cursor = initialStart ? new Date(initialStart) : new Date();
      if (cursor.getHours() < 8) cursor.setHours(8, 0, 0, 0);

      for (const line of targets) {
        const tempLine: ScheduleLine = {
          id: "tmp",
          jobNo: selected.job.jobNo,
          customerName: selected.job.customerName,
          planningLineDescription: line.description,
          startDateTime: cursor,
          endDateTime: cursor,
          estimatedHours: line.estimatedHours,
          overrideHours: null,
          employeeId: initialEmployeeId,
          departmentId: emp.departmentId,
          customerDueDate: new Date(selected.job.promisedDate),
          isLocked: false,
          jobSequence: line.lineNo,
        };
        const end = calculateEndTime(
          cursor,
          effectiveHours(tempLine, emp),
          emp,
          ctxForEngine,
        );

        const newLine: ScheduleLine = {
          ...tempLine,
          id: `line-${selected.job.jobNo}-${line.lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          endDateTime: end,
        };
        await addScheduleLine(newLine);
        cursor = new Date(end);
      }
      onClose();
      return;
    }

    // Auto-mode (or no preset employee): use the proposed-schedule output.
    if (!predictedSlots) return;
    for (const slot of predictedSlots) {
      if (!slot.employeeId || !slot.departmentId) continue;
      const newLine: ScheduleLine = {
        id: `line-${selected.job.jobNo}-${slot.lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        planningLineDescription: slot.description,
        startDateTime: slot.start,
        endDateTime: slot.end,
        estimatedHours: slot.estimatedHours,
        overrideHours: null,
        employeeId: slot.employeeId,
        departmentId: slot.departmentId,
        customerDueDate: new Date(selected.job.promisedDate),
        isLocked: false,
        jobSequence: slot.lineNo,
      };
      await addScheduleLine(newLine);
    }
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

  /**
   * Canvas-mirror commit for the BC flow. Mirrors the Production
   * Scheduling screen's Patch() call: one Resource-type planning line,
   * one employee, one start date. The end time is the engine's
   * 8-hour-day capacity walker output — which also skips weekends and
   * honors the resource's calendar, an improvement over the Canvas
   * app's naïve `RoundUp(hrs/8) - 1 days` formula.
   */
  const commitBcCanvas = async () => {
    if (!selected || singleLineNo === null || !bcEmployeeId) return;
    const line = selected.mappedLines.find((l) => l.lineNo === singleLineNo);
    if (!line) return;
    const emp = employees.get(bcEmployeeId);
    if (!emp) return;

    const [y, m, d] = bcStartDate.split("-").map((v) => parseInt(v, 10));
    const start = new Date(y, (m || 1) - 1, d || 1, 8, 0, 0, 0);

    const ctxForEngine = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const tempLine: ScheduleLine = {
      id: "tmp",
      jobNo: selected.job.jobNo,
      customerName: selected.job.customerName,
      planningLineDescription: line.description,
      startDateTime: start,
      endDateTime: start,
      estimatedHours: line.estimatedHours,
      overrideHours: null,
      employeeId: bcEmployeeId,
      departmentId: emp.departmentId,
      customerDueDate: new Date(selected.job.promisedDate),
      isLocked: false,
      jobSequence: line.lineNo,
    };
    const end = calculateEndTime(
      start,
      effectiveHours(tempLine, emp),
      emp,
      ctxForEngine,
    );

    await addScheduleLine({
      ...tempLine,
      id: `line-${selected.job.jobNo}-${line.lineNo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      endDateTime: end,
    });
    onClose();
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

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Add Job</div>

        {/* Kind toggle: BC Job (search) vs Custom Card (block out time) */}
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
        </div>

        {cardKind === "bc" && (
        <BcCanvasFlow
          query={query}
          setQuery={setQuery}
          results={results}
          loading={loading}
          selected={selected}
          setSelected={setSelected}
          singleLineNo={singleLineNo}
          setSingleLineNo={setSingleLineNo}
          bcEmployeeId={bcEmployeeId}
          setBcEmployeeId={setBcEmployeeId}
          bcStartDate={bcStartDate}
          setBcStartDate={setBcStartDate}
          employees={employees}
          departments={departments}
          scheduleState={scheduleState}
          workHoursState={workHoursState}
          overtimeState={overtimeState}
        />
        )}

        {cardKind === "custom" && (
          <div style={{ padding: 12, overflowY: "auto" }}>
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
              Quick pick
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
                marginBottom: 16,
              }}
            >
              {CUSTOM_CARD_PRESETS.map((p) => {
                const active = customTitle === p.label && customBg === p.bgColor;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    style={{
                      background: p.bgColor,
                      color: p.textColor,
                      padding: "10px 12px",
                      border: active ? "2px solid var(--lumineo-navy)" : "2px solid transparent",
                      borderRadius: 5,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
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

            {initialStart && (
              <div style={{ marginTop: 8, color: "var(--text-tertiary)", fontSize: 11 }}>
                Starts {format(initialStart, "EEE MMM d HH:mm")}
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={
              cardKind === "bc"
                ? !selected || singleLineNo === null || !bcEmployeeId
                : !customTitle ||
                  (customScope === "resource" && !customEmployeeId) ||
                  (customScope === "department" && !customDeptId) ||
                  customHours <= 0
            }
            onClick={cardKind === "bc" ? commitBcCanvas : commitCustom}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BcCanvasFlow — recreates the Canvas app's three-stage Add Job
// flow inside the AddJobPanel slide-over. Mirrors the screens in
// `Production Scheduling.pa.yaml`:
//   1. txtJobSearch + SearchIcon3 — lookup by BC job no.
//   2. galPlanningLines — filtered to `Type = "Resource"`
//   3. Dropdown_Employee + DP_StartDate + Schedule button
// Department auto-resolves from the planning-line description via
// the `Planning Line Department Maps` table (here served by the
// keyword rules in services/planning-line-mapping.ts).
// ============================================================

interface BcCanvasFlowProps {
  query: string;
  setQuery: (q: string) => void;
  results: JobSearchResult[];
  loading: boolean;
  selected: JobSearchResult | null;
  setSelected: (r: JobSearchResult | null) => void;
  singleLineNo: number | null;
  setSingleLineNo: (n: number | null) => void;
  bcEmployeeId: string;
  setBcEmployeeId: (id: string) => void;
  bcStartDate: string;
  setBcStartDate: (d: string) => void;
  employees: Map<string, import("../engine/types").Employee>;
  departments: Map<string, import("../engine/types").Department>;
  scheduleState: import("../engine/types").ScheduleLine[];
  workHoursState: import("../engine/types").WorkHoursOverride[];
  overtimeState: import("../engine/types").OvertimeOverride[];
}

function BcCanvasFlow({
  query,
  setQuery,
  results,
  loading,
  selected,
  setSelected,
  singleLineNo,
  setSingleLineNo,
  bcEmployeeId,
  setBcEmployeeId,
  bcStartDate,
  setBcStartDate,
  employees,
  departments,
  scheduleState,
  workHoursState,
  overtimeState,
}: BcCanvasFlowProps) {
  // Stage 2 filter — only `Type = "Resource"` planning lines, matching
  // galPlanningLines.Items in the Canvas app.
  const resourceLines = useMemo(() => {
    if (!selected) return [];
    return selected.mappedLines.filter((l) => {
      const raw = selected.job.planningLines.find((p) => p.lineNo === l.lineNo);
      return raw?.type === "Resource";
    });
  }, [selected]);

  const pickedLine = singleLineNo !== null
    ? resourceLines.find((l) => l.lineNo === singleLineNo) ?? null
    : null;

  // Stage 3 — when a line is picked, auto-resolve its department then
  // surface only the employees in that department in the dropdown.
  const pickedDept = pickedLine?.departmentId
    ? departments.get(pickedLine.departmentId)
    : undefined;
  const eligibleEmployees = useMemo(() => {
    if (!pickedLine?.departmentId) return [] as import("../engine/types").Employee[];
    return [...employees.values()].filter((e) => e.departmentId === pickedLine.departmentId);
  }, [employees, pickedLine]);

  // If the supervisor switches lines and the previously picked
  // employee no longer matches the new department, clear the pick.
  useEffect(() => {
    if (bcEmployeeId && pickedLine?.departmentId) {
      const emp = employees.get(bcEmployeeId);
      if (!emp || emp.departmentId !== pickedLine.departmentId) {
        setBcEmployeeId("");
      }
    }
  }, [pickedLine, bcEmployeeId, employees, setBcEmployeeId]);

  // Live preview of how the engine will split the estimated hours
  // across 8-hour workdays — skipping weekends and honoring the
  // resource's calendar.
  const splitPreview = useMemo(() => {
    if (!pickedLine || !bcEmployeeId) return null;
    const emp = employees.get(bcEmployeeId);
    if (!emp) return null;
    const [y, m, d] = bcStartDate.split("-").map((v) => parseInt(v, 10));
    if (!y || !m || !d) return null;
    const start = new Date(y, m - 1, d, 8, 0, 0, 0);
    const ctx = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const tempLine = {
      id: "preview",
      jobNo: "preview",
      customerName: "",
      planningLineDescription: pickedLine.description,
      startDateTime: start,
      endDateTime: start,
      estimatedHours: pickedLine.estimatedHours,
      overrideHours: null,
      employeeId: bcEmployeeId,
      departmentId: emp.departmentId,
      customerDueDate: null,
      isLocked: false,
      jobSequence: pickedLine.lineNo,
    } as import("../engine/types").ScheduleLine;
    const end = calculateEndTime(start, effectiveHours(tempLine, emp), emp, ctx);
    return { start, end };
  }, [pickedLine, bcEmployeeId, bcStartDate, employees, departments, scheduleState, workHoursState, overtimeState]);

  return (
    <>
      {/* ============ Stage 1 — Job number search ============ */}
      <div style={{ padding: 12 }}>
        <input
          className="form-field__input"
          style={{ width: "100%", borderRadius: 4 }}
          placeholder="Search BC job number (e.g. J103101 or 103101)…"
          value={query}
          onChange={(e) => {
            // Canvas normalizes to ensure "J" prefix on Enter; here we
            // accept either form and let the search service handle both.
            setQuery(e.target.value);
            setSelected(null);
            setSingleLineNo(null);
          }}
          autoFocus
        />
        {loading && <div className="loading">Searching…</div>}
        {!selected && results.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
            {results.map((r) => (
              <li key={r.job.jobNo} style={{ marginBottom: 4 }}>
                <button
                  className="btn-secondary"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setSelected(r);
                    setSingleLineNo(null);
                  }}
                >
                  <strong>{r.job.jobNo}</strong> — {r.job.customerName} · due {format(new Date(r.job.promisedDate), "MMM d")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============ Stage 2 — Planning lines (Resource only) ============ */}
      {selected && (
        <>
          <div className="section-title" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span>{selected.job.jobNo} · {selected.job.customerName}</span>
            {selected.job.description && (
              <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.78 }}>{selected.job.description}</span>
            )}
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Planning lines · Resources only
            </div>
            {resourceLines.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: 12, background: "var(--bg-secondary)", borderRadius: 4 }}>
                No Resource-type planning lines on this job.
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {resourceLines.map((line) => {
                  const dept = line.departmentId ? departments.get(line.departmentId) : undefined;
                  const isPicked = singleLineNo === line.lineNo;
                  return (
                    <li key={line.lineNo} style={{ marginBottom: 6 }}>
                      <button
                        type="button"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 4,
                          border: isPicked
                            ? "2px solid var(--lumineo-navy)"
                            : "1px solid var(--border)",
                          background: isPicked ? "var(--label-bg)" : "var(--bg-secondary)",
                          cursor: "pointer",
                        }}
                        onClick={() => setSingleLineNo(line.lineNo)}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{line.description}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          {line.estimatedHours}h · {dept?.name ?? <em>no dept match</em>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* ============ Stage 3 — Employee + start date + preview ============ */}
      {pickedLine && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Department
            </span>
            <span
              style={{
                padding: "2px 8px",
                background: pickedDept?.color ?? "var(--bg-tertiary)",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {pickedDept?.name ?? "Unmapped"}
            </span>
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Employee
            </span>
            <select
              className="form-field__input"
              style={{ width: "100%", borderRadius: 4, marginTop: 4 }}
              value={bcEmployeeId}
              onChange={(e) => setBcEmployeeId(e.target.value)}
              disabled={eligibleEmployees.length === 0}
            >
              <option value="">{eligibleEmployees.length === 0 ? "No employees in this department" : "Select…"}</option>
              {eligibleEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {Math.round(e.productivityRate * 100)}% · {e.standardHoursPerDay}h/day
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Start date
            </span>
            <input
              type="date"
              className="form-field__input"
              style={{ width: "100%", borderRadius: 4, marginTop: 4 }}
              value={bcStartDate}
              onChange={(e) => setBcStartDate(e.target.value)}
            />
          </label>

          {splitPreview && (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              <strong style={{ color: "var(--text-primary)" }}>
                {pickedLine.estimatedHours}h split across {Math.ceil(pickedLine.estimatedHours / 8)} day{Math.ceil(pickedLine.estimatedHours / 8) === 1 ? "" : "s"}
              </strong>
              <div style={{ marginTop: 2 }}>
                {format(splitPreview.start, "EEE MMM d, h:mm a")} → {format(splitPreview.end, "EEE MMM d, h:mm a")}
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: "var(--text-tertiary)" }}>
                Engine skips weekends and honors the resource's calendar.
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
