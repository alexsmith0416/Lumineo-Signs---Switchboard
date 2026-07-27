import { useEffect, useState } from "react";
import { format } from "date-fns";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import type { ScheduleContext, ScheduleLine } from "../engine/types";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { useLivePreview } from "../hooks/useLivePreview";
import { useSettingsStore } from "../store/settings-store";
import { placeDraft } from "../services/schedule-draft";
import type { BatchItem } from "../services/batch-schedule";
import { useJobTargets } from "../hooks/useJobTargets";
import ConfirmDialog from "./ConfirmDialog";
import JobTaskPicker from "./JobTaskPicker";
import JobSchedulePanel from "./JobSchedulePanel";
import ProductionStepperSection from "./ProductionStepperSection";
import { JobTargetsSection, ProductionCompleteField } from "./JobTargets";

// Start/End are edited as dates only, but the engine schedules with times, so we
// keep the time-of-day on the underlying datetime-local string and only swap the
// date part when the user picks a new day.
const datePart = (dt: string): string => dt.slice(0, 10);
const timePart = (dt: string): string => dt.slice(11, 16) || "08:00";

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {locked ? (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      )}
    </svg>
  );
}

interface EditJobPanelProps {
  line: ScheduleLine;
  onClose: () => void;
  useStore?: UseScheduleStore;
  /** View-only: disable every field and hide Save/Delete/Duplicate. */
  readOnly?: boolean;
  /** "create" = adding a NEW (unscheduled) card: employee/start/end start blank,
   *  Delete/Duplicate are hidden, and the footer shows Schedule / Auto Schedule
   *  which places the card via placeDraft. Default "edit". */
  mode?: "edit" | "create";
  /** Called after a create-mode card is scheduled (defaults to onClose). Lets a
   *  batch flow keep the panel open / advance to the next job later. */
  onScheduled?: () => void;
  /** Batch mode (create only): the footer becomes "Add to list" and calls
   *  onAddToBatch with the configured item instead of scheduling now. */
  batchMode?: boolean;
  onAddToBatch?: (item: BatchItem) => void;
}

export default function EditJobPanel({
  line,
  onClose,
  useStore = useScheduleStore,
  readOnly = false,
  mode = "edit",
  onScheduled,
  batchMode = false,
  onAddToBatch,
}: EditJobPanelProps) {
  const isCreate = mode === "create";
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);
  const schedule = useStore((s) => s.schedule);
  const workHours = useStore((s) => s.workHours);
  const overtime = useStore((s) => s.overtime);
  const dataSource = useStore((s) => s.dataSource);
  const updateTaskHours = useStore((s) => s.updateTaskHours);
  const shiftTaskAndCommit = useStore((s) => s.shiftTaskAndCommit);
  const loadWeek = useStore((s) => s.loadWeek);
  const deleteScheduleLine = useStore((s) => s.deleteScheduleLine);
  const addScheduleLine = useStore((s) => s.addScheduleLine);

  // Trips/crew and Install ZIP are install-only widgets.
  const isInstall = dataSource.kind === "installation";
  // Respect the global cascade setting on save (matches drag/resize behavior);
  // cascade off = move/resize this task only, no downstream push.
  const cascadeEnabled = useSettingsStore((s) => s.cascadeEnabled);

  const [duplicating, setDuplicating] = useState(false);
  const [dupEmployeeIds, setDupEmployeeIds] = useState<Set<string>>(new Set());

  // Modified labor hours — the editable override of the fixed BC estimate. Empty
  // means "no override → use the estimate". (Estimated hours itself is read-only.)
  const [overrideHours, setOverrideHours] = useState(line.overrideHours?.toString() ?? "");
  const [jobDescription, setJobDescription] = useState(line.jobDescription ?? "");
  const [taskDescription, setTaskDescription] = useState(line.planningLineDescription ?? "");
  const [crewTrips, setCrewTrips] = useState(line.crewTrips?.toString() ?? "");
  const [crewPersons, setCrewPersons] = useState(line.crewPersons?.toString() ?? "");
  const [crewTrucks, setCrewTrucks] = useState(line.crewTrucks?.toString() ?? "");
  const [installZip, setInstallZip] = useState(line.installZip ?? "");
  const [finalInstall, setFinalInstall] = useState(!!line.finalInstall);
  // Create mode starts unscheduled with no start date. The employee is seeded
  // from the draft: when the add was started by clicking a person's day cell the
  // draft carries that employee (pre-select them here); when started from the
  // toolbar "Add Job" button the draft's employeeId is blank (stays "auto").
  const [employeeId, setEmployeeId] = useState(line.employeeId);
  const [startDate, setStartDate] = useState(
    isCreate ? "" : format(line.startDateTime, "yyyy-MM-dd'T'HH:mm"),
  );
  const [isLocked, setIsLocked] = useState(line.isLocked);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Set when the user re-picks the job's BC tasks: their descriptions + summed
  // BC estimated hours replace the card's text and re-link the base hours
  // (clearing any manual override) on save.
  const [repick, setRepick] = useState<{ descriptions: string[]; hours: number } | null>(null);

  // Live end preview shared by the End field + the Predicted pane.
  const startObj = startDate ? new Date(startDate) : null;
  // Empty Modified labor hours → fall back to the fixed estimate.
  const hoursNum = overrideHours.trim() === "" ? line.estimatedHours : Number(overrideHours);
  const preview = useLivePreview(
    startObj,
    Number.isNaN(hoursNum) ? line.estimatedHours : hoursNum,
    null,
    employeeId,
    useStore,
    line.id,
    true, // manual edit: span the task's own hours regardless of a full day
  );

  // The End field mirrors the computed end, but holds the user's picked value
  // during a change so a native picker doesn't snap it back.
  const [endInput, setEndInput] = useState(() =>
    isCreate ? "" : format(line.endDateTime, "yyyy-MM-dd'T'HH:mm"),
  );
  useEffect(() => {
    if (preview.end) setEndInput(format(preview.end, "yyyy-MM-dd'T'HH:mm"));
  }, [preview.end]);

  // Editing End sets the duration: binary-search the hours whose engine end lands
  // on the picked date (the engine re-derives end from hours on reload, so the
  // end has to be expressed as hours to persist).
  const onEndChange = (v: string) => {
    const emp = employees.get(employeeId);
    if (!emp || !startObj || !v) return;
    const target = new Date(v);
    if (Number.isNaN(target.getTime()) || target.getTime() <= startObj.getTime()) return;
    const ctx: ScheduleContext = { employees, departments, schedule, workHours, overtime };
    const endAt = (h: number) => calculateEndTime(startObj, h, emp, ctx, line.id, true).getTime();
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40 && endAt(hi) < target.getTime(); i++) hi *= 2;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (endAt(mid) < target.getTime()) lo = mid;
      else hi = mid;
    }
    const rate = emp.productivityRate === 0 ? 1 : emp.productivityRate;
    // Snap to whole-DAY chunks (8h) to match the board resize; exact sub-day
    // hours are typed straight into the Modified labor hours box.
    const dayH = emp.standardHoursPerDay || 8;
    const exact = ((lo + hi) / 2) * rate;
    const snapped = Math.max(dayH, Math.round(exact / dayH) * dayH);
    setOverrideHours(String(snapped));
  };

  const onSave = async () => {
    setBusy(true);
    try {
      // Empty Modified labor hours → no override (use the estimate).
      const newHours = overrideHours.trim() === "" ? line.estimatedHours : Number(overrideHours);
      // Only write hours when they actually changed. Compare against the line's
      // CURRENT effective hours (override if set, else the BC estimate) — not
      // line.overrideHours, which is usually null, so the old check fired an
      // hours write on every save. That spurious write carried the OLD start and
      // raced the shift below, which is why a manual date change often reverted.
      const curHours = line.overrideHours ?? line.estimatedHours;
      // When tasks were re-picked, the hours change is applied below as the new
      // base estimatedHours (override cleared) — so skip the override path here.
      if (!repick && !Number.isNaN(newHours) && newHours !== curHours) {
        await updateTaskHours(line.id, newHours, cascadeEnabled);
      }
      const newStart = new Date(startDate);
      if (
        newStart.getTime() !== line.startDateTime.getTime() ||
        employeeId !== line.employeeId
      ) {
        await shiftTaskAndCommit(line.id, newStart, employeeId, cascadeEnabled);
      }
      const numOrNull = (v: string): number | null => {
        const t = v.trim();
        if (t === "") return null;
        const n = Number(t);
        return Number.isNaN(n) ? null : n;
      };
      const changes: Partial<ScheduleLine> = {};
      if (isLocked !== line.isLocked) changes.isLocked = isLocked;
      if (repick) {
        // Re-link the card to the newly-chosen BC tasks: text + base estimated
        // hours, clearing any override. A manual edit to the Hours field after
        // re-picking wins over the summed estimate. loadWeek re-derives the end.
        changes.jobDescription = jobDescription;
        changes.planningLineDescription = taskDescription;
        changes.estimatedHours = !Number.isNaN(newHours) && newHours > 0 ? newHours : repick.hours;
        changes.overrideHours = null;
      } else if (
        jobDescription !== (line.jobDescription ?? "") ||
        taskDescription !== (line.planningLineDescription ?? "")
      ) {
        changes.jobDescription = jobDescription;
        changes.planningLineDescription = taskDescription;
      }
      if (numOrNull(crewTrips) !== (line.crewTrips ?? null)) changes.crewTrips = numOrNull(crewTrips);
      if (numOrNull(crewPersons) !== (line.crewPersons ?? null))
        changes.crewPersons = numOrNull(crewPersons);
      if (numOrNull(crewTrucks) !== (line.crewTrucks ?? null))
        changes.crewTrucks = numOrNull(crewTrucks);
      if ((installZip.trim() || null) !== (line.installZip ?? null))
        changes.installZip = installZip.trim() || null;
      if (finalInstall !== !!line.finalInstall) changes.finalInstall = finalInstall;
      if (Object.keys(changes).length > 0) {
        await dataSource.updateScheduleLine(line.id, changes);
        await loadWeek();
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteScheduleLine(line.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // Duplicate this card onto one or more other employees (same job, task, hours,
  // and start day; end recomputed per employee).
  const onDuplicate = async () => {
    if (dupEmployeeIds.size === 0) return;
    setBusy(true);
    try {
      const ctx: ScheduleContext = { employees, departments, schedule, workHours, overtime };
      for (const empId of dupEmployeeIds) {
        const emp = employees.get(empId);
        if (!emp) continue;
        const copy: ScheduleLine = {
          ...line,
          id: `line-${line.jobNo || "job"}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          employeeId: emp.id,
          departmentId: emp.departmentId,
          preferredStart: line.startDateTime,
        };
        const end = calculateEndTime(line.startDateTime, effectiveHours(copy, emp), emp, ctx, copy.id);
        await addScheduleLine({ ...copy, endDateTime: end });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  // Job targets (release-date rules) — used to pre-fill the target section and to
  // capture sort keys when a job is added to a batch list.
  const jobTargets = useJobTargets(line.jobNo);

  // Build the configured draft + chosen hours from the (pre-filled + edited)
  // fields. Shared by Schedule / Auto Schedule and Add-to-list.
  const makeDraft = (): { draft: ScheduleLine; hours: number } => {
    const hoursStr = overrideHours.trim();
    const parsed = hoursStr === "" ? line.estimatedHours : Number(hoursStr);
    const hours = Number.isNaN(parsed) || parsed <= 0 ? line.estimatedHours : parsed;
    const num = (v: string): number | null => {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isNaN(n) ? null : n;
    };
    const draft: ScheduleLine = {
      ...line,
      jobDescription,
      planningLineDescription: taskDescription,
      estimatedHours: hours,
      overrideHours: null,
      isLocked,
      installZip: installZip.trim() || null,
      crewTrips: num(crewTrips),
      crewPersons: num(crewPersons),
      crewTrucks: num(crewTrucks),
      finalInstall: isInstall ? finalInstall : undefined,
    };
    return { draft, hours };
  };

  // Create mode: build the draft and place it. Schedule (employee + start) drops
  // it exactly there; Auto Schedule (either blank) finds the next open slot — for
  // the chosen employee, or the least-loaded person in the task's department.
  const onCreate = async () => {
    setBusy(true);
    try {
      const { draft } = makeDraft();
      const ctx: ScheduleContext = { employees, departments, schedule, workHours, overtime };
      const placed = placeDraft({
        draft,
        employeeId: employeeId || null,
        start: startDate ? new Date(startDate) : null,
        ctx,
        singleDay: isInstall, // installs complete their scheduled day
      });
      if (!placed) {
        setBusy(false);
        return;
      }
      await addScheduleLine(placed);
      (onScheduled ?? onClose)();
    } finally {
      setBusy(false);
    }
  };

  // Batch mode: stage the configured job in the priority list instead of
  // scheduling it now (it schedules later, with the rest, in list order).
  const onAdd = () => {
    const { draft, hours } = makeDraft();
    const empId = employeeId || null;
    onAddToBatch?.({
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      draft,
      employeeId: empId,
      start: startDate ? new Date(startDate) : null,
      employeeName: empId ? employees.get(empId)?.name ?? null : null,
      hours,
      releaseDate: jobTargets.released ?? null,
      productionComplete: jobTargets.targets.targetProductionComplete ?? null,
      installWindow: jobTargets.targets.installWindowStart ?? null,
    });
    onClose();
  };

  return (
    <>
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <span>
            {isCreate && <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-tertiary)" }}>New · </span>}
            {line.jobNo} · {line.customerName}
            {readOnly && <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--text-tertiary)" }}>· View only</span>}
          </span>
          {!readOnly && (
            <button
              type="button"
              className={"section-title__lock" + (isLocked ? " section-title__lock--on" : "")}
              onClick={() => setIsLocked((v) => !v)}
              title="Pin task — cascade flows around it"
              aria-pressed={isLocked}
            >
              <LockIcon locked={isLocked} />
            </button>
          )}
        </div>

        <div className="form-field">
          <div className="form-field__label">Job description</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="BC job summary (shown under the job name)"
            style={{ resize: "vertical", fontFamily: "inherit", alignContent: "center" }}
            disabled={readOnly}
          />
        </div>
        {line.jobNo && !line.isCustom && !isCreate && (
          <div className="form-field form-field--block">
            <JobTaskPicker
              jobNo={line.jobNo}
              kind={isInstall ? "installation" : "production"}
              currentDescriptions={taskDescription.split("\n")}
              disabled={readOnly}
              onChange={(descriptions, totalHours) => {
                setTaskDescription(descriptions.join("\n"));
                const h = totalHours || line.estimatedHours;
                setOverrideHours(String(h));
                setRepick({ descriptions, hours: h });
              }}
            />
          </div>
        )}
        <div className="form-field">
          <div className="form-field__label">Task / card text</div>
          <textarea
            className="form-field__input"
            rows={2}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Task description shown on the card"
            style={{ resize: "vertical", fontFamily: "inherit", alignContent: "center" }}
            disabled={readOnly}
          />
        </div>

        {line.jobNo && !line.isCustom && <JobTargetsSection jobNo={line.jobNo} />}

        {line.jobNo && !line.isCustom && <ProductionStepperSection jobNo={line.jobNo} />}

        <div className="form-field">
          <div className="form-field__label">Employee</div>
          <select
            className="form-field__select"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={readOnly}
          >
            {isCreate && <option value="">Select employee… (blank = auto)</option>}
            {[...employees.values()].map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <div className="form-field__label">Start</div>
          <input
            className="form-field__input"
            type="date"
            value={datePart(startDate)}
            onChange={(e) => {
              if (e.target.value) setStartDate(e.target.value + "T" + timePart(startDate));
            }}
            disabled={readOnly}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Estimated hours</div>
          <input
            className="form-field__input"
            type="text"
            value={line.estimatedHours}
            readOnly
            disabled
            title="The task's BC estimate — fixed. Change the actual hours in Modified labor hours."
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Modified labor hours</div>
          <input
            className="form-field__input"
            type="number"
            min="0.25"
            step="0.25"
            value={overrideHours}
            onChange={(e) => setOverrideHours(e.target.value)}
            placeholder={`estimate: ${line.estimatedHours}`}
            title="Actual working hours for this card (overrides the estimate). Leave blank to use the estimate."
            disabled={readOnly}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">End</div>
          <input
            className="form-field__input"
            type="date"
            value={datePart(endInput)}
            onChange={(e) => {
              if (!e.target.value) return;
              const dt = e.target.value + "T" + timePart(endInput);
              setEndInput(dt);
              onEndChange(dt);
            }}
            onBlur={(e) => {
              if (e.target.value) onEndChange(e.target.value + "T" + timePart(endInput));
            }}
            title="Set the end date — adjusts the hours to land here"
            disabled={readOnly}
          />
        </div>
        {line.jobNo && !line.isCustom && (
          <ProductionCompleteField jobNo={line.jobNo} readOnly={readOnly} />
        )}
        {line.jobNo && !line.isCustom && (
          <JobSchedulePanel jobNo={line.jobNo} readOnly={readOnly} />
        )}

        {isInstall && (
        <>
        <div className="form-field">
          <div className="form-field__label">Trips · crew per trip</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewTrips}
              onChange={(e) => setCrewTrips(e.target.value)}
              placeholder="Trips"
              title="Number of trips"
              disabled={readOnly}
            />
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewPersons}
              onChange={(e) => setCrewPersons(e.target.value)}
              placeholder="Men"
              title="Men per trip"
              disabled={readOnly}
            />
            <input
              className="form-field__input"
              type="number"
              min="0"
              step="1"
              value={crewTrucks}
              onChange={(e) => setCrewTrucks(e.target.value)}
              placeholder="Trucks"
              title="Trucks per trip"
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="form-field">
          <div className="form-field__label">Install ZIP (weather)</div>
          <input
            className="form-field__input"
            value={installZip}
            onChange={(e) => setInstallZip(e.target.value)}
            placeholder="e.g. 67501"
            disabled={readOnly}
          />
        </div>
        <div className="form-field">
          <div className="form-field__label">Final install</div>
          <label
            style={{
              background: "var(--input-bg)",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={finalInstall}
              onChange={(e) => setFinalInstall(e.target.checked)}
              disabled={readOnly}
            />
            <span style={{ fontSize: 12 }}>
              This card&apos;s day sets the job&apos;s scheduled install date
            </span>
          </label>
        </div>
        </>
        )}

        {(!isCreate || (employeeId && startDate)) && (
          <PreviewPane
            startInput={startDate}
            hours={overrideHours.trim() === "" ? line.estimatedHours : Number(overrideHours)}
            employeeId={employeeId}
            useStore={useStore}
            currentEnd={line.endDateTime}
            ignoreLineId={line.id}
            hideComparison={isCreate}
          />
        )}

        <div style={{ flex: 1 }} />

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}
        >
          {isCreate && batchMode ? (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn-secondary" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={onAdd}
                title="Add this configured job to the schedule list — it schedules with the rest, in priority order"
              >
                {employeeId && startDate ? "Add to list (scheduled)" : "Add to list (auto)"}
              </button>
            </>
          ) : isCreate ? (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn-secondary" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={onCreate}
                title={
                  employeeId && startDate
                    ? "Schedule this card to the chosen employee on the chosen day"
                    : "Auto-schedule to the next open slot (of the chosen employee, or the least-loaded person in the department)"
                }
              >
                {busy ? "Scheduling…" : employeeId && startDate ? "Schedule" : "Auto Schedule"}
              </button>
            </>
          ) : readOnly ? (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn-primary" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-danger"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDupEmployeeIds(new Set());
                  setDuplicating(true);
                }}
              >
                Duplicate
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn-secondary" disabled={busy} onClick={onClose}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy} onClick={onSave}>
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    {confirmingDelete && (
      <ConfirmDialog
        title="Delete this card?"
        message="Are you sure you want to delete this scheduled job card? This can't be undone."
        confirmLabel="Yes"
        cancelLabel="Cancel"
        danger
        busy={busy}
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    )}
    {duplicating && (
      <div
        className="modal-scrim"
        onClick={(e) => {
          e.stopPropagation();
          setDuplicating(false);
        }}
      >
        <div
          className="modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", flexDirection: "column", maxHeight: "80vh" }}
        >
          <div className="modal-card__title">Duplicate to employees</div>
          <div className="modal-card__body" style={{ padding: "0 0 8px" }}>
            {line.jobNo} · {line.customerName} — pick who else gets this card.
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {[...employees.values()]
              .filter((e) => e.id !== line.employeeId)
              .map((e) => {
                const checked = dupEmployeeIds.has(e.id);
                return (
                  <label
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 8px",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDupEmployeeIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(e.id)) next.delete(e.id);
                          else next.add(e.id);
                          return next;
                        })
                      }
                    />
                    <span>{e.name}</span>
                    {e.truckNumber && (
                      <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{e.truckNumber}</span>
                    )}
                  </label>
                );
              })}
          </div>
          <div className="modal-card__actions">
            <button className="btn-secondary" disabled={busy} onClick={() => setDuplicating(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={busy || dupEmployeeIds.size === 0}
              onClick={onDuplicate}
            >
              {busy ? "Duplicating…" : `Duplicate (${dupEmployeeIds.size})`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

interface PreviewPaneProps {
  startInput: string;
  hours: number;
  employeeId: string;
  useStore: UseScheduleStore;
  currentEnd: Date;
  ignoreLineId?: string;
  /** Create mode: no existing end to compare against — hide the changed / was bits. */
  hideComparison?: boolean;
}

function PreviewPane({ startInput, hours, employeeId, useStore, currentEnd, ignoreLineId, hideComparison }: PreviewPaneProps) {
  const start = startInput ? new Date(startInput) : null;
  const preview = useLivePreview(
    start,
    hours,
    null,
    employeeId,
    useStore,
    ignoreLineId,
  );
  const changedEnd =
    !hideComparison && preview.end && preview.end.getTime() !== currentEnd.getTime();
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-secondary)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
        Predicted
      </div>
      {preview.end ? (
        <>
          <div>
            End{changedEnd && <span style={{ color: "var(--lumineo-red)", marginLeft: 6, fontSize: 10 }}>changed</span>}:{" "}
            <strong>{format(preview.end, "EEE MMM d HH:mm")}</strong>
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
            {preview.effectiveHours.toFixed(2)}h scheduled
            {!hideComparison && <> · was {format(currentEnd, "MMM d HH:mm")}</>}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--text-tertiary)" }}>Enter a valid start and hours.</div>
      )}
    </div>
  );
}
