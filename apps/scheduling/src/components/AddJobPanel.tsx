import { useMemo, useState } from "react";
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
import { CUSTOM_CARD_PRESETS, type CustomCardPreset } from "../data/custom-card-presets";
import { useLoadsStore } from "../shipping/loads-store";
import { shipmentSummary } from "../shipping/types";
import type { ScheduleLine } from "../engine/types";

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
  const [customShipmentLoadId, setCustomShipmentLoadId] = useState<string>("");

  const kind = useStore((s) => s.dataSource.kind);
  const loads = useLoadsStore((s) => s.loads);
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);

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

  const targetLineNos = useMemo(() => {
    if (!selected) return new Set<number>();
    if (mode === "single") {
      return new Set<number>(singleLineNo !== null ? [singleLineNo] : []);
    }
    if (mode === "multi") return new Set<number>(checkedLines);
    return new Set<number>(visibleLines.map((l) => l.lineNo));
  }, [selected, visibleLines, mode, singleLineNo, checkedLines]);

  const predictedSlots = useMemo(() => {
    if (!selected || targetLineNos.size === 0) return null;
    const ctx = {
      employees,
      departments,
      schedule: scheduleState,
      workHours: workHoursState,
      overtime: overtimeState,
    };
    const targets = visibleLines.filter((l) => targetLineNos.has(l.lineNo));
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
  }, [selected, targetLineNos, employees, departments, scheduleState, workHoursState, overtimeState, initialStart, initialEmployeeId, mode]);

  const commit = async () => {
    if (!selected) return;

    const targets =
      mode === "single" && singleLineNo !== null
        ? visibleLines.filter((l) => l.lineNo === singleLineNo)
        : mode === "multi"
          ? visibleLines.filter((l) => checkedLines.has(l.lineNo))
          : visibleLines;

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
          customerDueDate: safeDate(selected.job.promisedDate),
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
        customerDueDate: safeDate(selected.job.promisedDate),
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
                      onClick={() => setSelected(r)}
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
                <button
                  className={mode === "auto" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("auto")}
                >
                  Auto-schedule
                </button>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {visibleLines.map((line) => {
                  const dept = line.departmentId ? departments.get(line.departmentId) : undefined;
                  const proposedSlot = predictedSlots?.find((p) => p.lineNo === line.lineNo);
                  const isCurrent = targetLineNos.has(line.lineNo);
                  return (
                    <li
                      key={line.lineNo}
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        marginBottom: 6,
                        background: isCurrent ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                        cursor: mode === "auto" ? "default" : "pointer",
                      }}
                      onClick={() => {
                        if (mode === "single") setSingleLineNo(line.lineNo);
                        else if (mode === "multi") {
                          const next = new Set(checkedLines);
                          if (next.has(line.lineNo)) next.delete(line.lineNo);
                          else next.add(line.lineNo);
                          setCheckedLines(next);
                        }
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {line.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {line.estimatedHours}h · {dept?.name ?? "unmapped"}
                      </div>
                      {proposedSlot && proposedSlot.employeeId && (
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                          → {employees.get(proposedSlot.employeeId)?.name ?? proposedSlot.employeeId} on{" "}
                          {format(proposedSlot.start, "EEE MMM d")} {format(proposedSlot.start, "HH:mm")}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
        </>
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
                  {[...loads]
                    .filter((l) => l.status === "loaded" || l.status === "delivered")
                    .sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime())
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} · {l.items.length} item{l.items.length === 1 ? "" : "s"}
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
                ? !selected ||
                  (mode === "single" && singleLineNo === null) ||
                  (mode === "multi" && checkedLines.size === 0)
                : !customTitle ||
                  (customScope === "resource" && !customEmployeeId) ||
                  (customScope === "department" && !customDeptId) ||
                  customHours <= 0
            }
            onClick={cardKind === "bc" ? commit : commitCustom}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
