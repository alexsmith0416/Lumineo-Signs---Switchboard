import { useState } from "react";
import { format, startOfWeek } from "date-fns";
import type { Department, Employee } from "../engine/types";
import type { ResourceAdminInput, ScheduleKind } from "../services/data-source";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
  type UseScheduleStore,
} from "../store/schedule-store";
import { useAssistStore } from "../store/assist-store";
import {
  createAssistRow,
  removeAssistRow,
  updateAssistRow,
  type AssistHalf,
} from "../services/dataverse-live";
import { INSTALL_LOCATIONS, REGION_LOCATIONS } from "../services/install-meta";
import ConfirmDialog from "./ConfirmDialog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface EmployeeAdminPanelProps {
  kind: ScheduleKind;
  mode: "create" | "edit";
  /** Present in edit mode. */
  emp?: Employee;
  /** Production department options (and current values). */
  departments: Map<string, Department>;
  /** Installation current region (crfdf_region): false = WK, true = NEK. */
  regionIsNek?: boolean;
  /** Create mode: the group right-clicked — a department id (production) or a
   *  location option value as string (installation). */
  initialGroupId?: string;
  useStore: UseScheduleStore;
  onClose: () => void;
}

/** Zero-pad a position to the table's 2-digit convention ("02", "11"). */
const padPos = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(2, "0");

/**
 * Roster admin editor. Right-click a name to edit (with Delete), or a group
 * header to add a new member. Production edits name + department; installation
 * edits the full crew row (region / location / position / truck / CCO).
 */
export default function EmployeeAdminPanel({
  kind,
  mode,
  emp,
  departments,
  regionIsNek,
  initialGroupId,
  useStore,
  onClose,
}: EmployeeAdminPanelProps) {
  const isInstall = kind === "installation";
  const createResource = useStore((s) => s.createResource);
  const updateResource = useStore((s) => s.updateResource);
  const deleteResource = useStore((s) => s.deleteResource);

  const deptList = [...departments.values()].sort((a, b) => a.flowOrder - b.flowOrder);

  const [name, setName] = useState(emp?.name ?? "");
  // Production grouping.
  const [departmentId, setDepartmentId] = useState(
    emp?.departmentId ?? initialGroupId ?? deptList[0]?.id ?? "",
  );
  // Installation grouping + attributes.
  const [region, setRegion] = useState<boolean>(regionIsNek ?? false);
  const [location, setLocation] = useState<number>(
    emp ? Number(emp.departmentId) || 0 : Number(initialGroupId) || REGION_LOCATIONS.wk[0]!,
  );
  const [position, setPosition] = useState(padPos(emp?.position ?? 0));
  const [truck, setTruck] = useState(emp?.truckNumber ?? "");
  const [cco, setCco] = useState<boolean>(!!emp?.isCertifiedCraneOperator);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locOptions = REGION_LOCATIONS[region ? "nek" : "wk"];

  // --- Assist Installation (production employee lent to an install board) ----
  const weekStart = useStore((s) => s.weekStart);
  const assistRows = useAssistStore((s) => s.rows);
  const assistMonday = format(startOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const currentAssist =
    !isInstall && emp
      ? assistRows.find((a) => a.sourceEmpId === emp.id && a.weekStart === assistMonday)
      : undefined;
  const [assistRegionNek, setAssistRegionNek] = useState(false);
  const [assistAllWeek, setAssistAllWeek] = useState(true);
  // Selected assist days → which half (full / am / pm). A day absent from the
  // map is not an assist day; present means full unless set to am/pm.
  const [assistDayHalf, setAssistDayHalf] = useState<Map<number, AssistHalf>>(new Map());
  // True while editing an EXISTING assist's days (vs. creating a new one).
  const [editingAssist, setEditingAssist] = useState(false);

  const setDayHalf = (day: number, half: AssistHalf | null) =>
    setAssistDayHalf((prev) => {
      const next = new Map(prev);
      if (half === null) next.delete(day);
      else next.set(day, half);
      return next;
    });

  const reloadAfterAssist = async () => {
    await useAssistStore.getState().refresh();
    await Promise.all([
      useInstallationStoreWK.getState().loadWeek(),
      useInstallationStoreNEK.getState().loadWeek(),
    ]);
  };

  const onAssign = async () => {
    if (!emp) return;
    setBusy(true);
    setErr(null);
    try {
      const days = assistAllWeek ? [] : [...assistDayHalf.keys()].sort((a, b) => a - b);
      const halves: Record<number, "am" | "pm"> = {};
      if (!assistAllWeek) {
        for (const [d, h] of assistDayHalf) if (h === "am" || h === "pm") halves[d] = h;
      }
      await createAssistRow({
        sourceEmpId: emp.id,
        name: emp.name,
        regionIsNek: assistRegionNek,
        weekStart: assistMonday,
        days,
        halves,
      });
      await reloadAfterAssist();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRemoveAssist = async () => {
    if (!currentAssist) return;
    setBusy(true);
    setErr(null);
    try {
      await removeAssistRow(currentAssist.id);
      await reloadAfterAssist();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Enter "edit days" mode on the current assist: pre-fill the day picker from
  // its stored days (an all-week assist expands to all five so days can be
  // dropped individually), each carrying its stored half.
  const startEditAssist = () => {
    if (!currentAssist) return;
    const days = currentAssist.days.length ? currentAssist.days : [0, 1, 2, 3, 4];
    const m = new Map<number, AssistHalf>();
    for (const d of days) m.set(d, currentAssist.halves[d] ?? "full");
    setAssistDayHalf(m);
    setEditingAssist(true);
  };

  // Save edited days: no days left → remove the whole assist; otherwise update
  // the existing row's days/halves in place.
  const onSaveAssistEdit = async () => {
    if (!currentAssist) return;
    setBusy(true);
    setErr(null);
    try {
      const days = [...assistDayHalf.keys()].sort((a, b) => a - b);
      if (days.length === 0) {
        await removeAssistRow(currentAssist.id);
      } else {
        const halves: Record<number, "am" | "pm"> = {};
        for (const [d, h] of assistDayHalf) if (h === "am" || h === "pm") halves[d] = h;
        await updateAssistRow(currentAssist.id, { days, halves });
      }
      await reloadAfterAssist();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRegionChange = (next: boolean) => {
    setRegion(next);
    const opts = REGION_LOCATIONS[next ? "nek" : "wk"];
    if (!opts.includes(location)) setLocation(opts[0]!);
  };

  /** Build the input payload. Edit sends only changed fields; create sends all. */
  const buildInput = (): ResourceAdminInput => {
    const input: ResourceAdminInput = {};
    const trimmedName = name.trim();
    if (mode === "create" || trimmedName !== emp?.name) input.name = trimmedName;

    if (isInstall) {
      const padded = padPos(Number(position) || 0);
      const truckNorm = truck.trim();
      if (mode === "create") {
        input.region = region;
        input.location = location;
        input.position = padded;
        input.truckNumber = truckNorm === "" ? null : truckNorm;
        input.isCertifiedCraneOperator = cco;
      } else if (emp) {
        if (region !== regionIsNek) input.region = region;
        if (location !== (Number(emp.departmentId) || 0)) input.location = location;
        if (padded !== padPos(emp.position ?? 0)) input.position = padded;
        if (truckNorm !== (emp.truckNumber ?? ""))
          input.truckNumber = truckNorm === "" ? null : truckNorm;
        if (cco !== !!emp.isCertifiedCraneOperator) input.isCertifiedCraneOperator = cco;
      }
    } else {
      if (mode === "create" || departmentId !== emp?.departmentId)
        input.departmentId = departmentId;
    }
    return input;
  };

  const onSave = async () => {
    setBusy(true);
    setErr(null);
    try {
      const input = buildInput();
      if (mode === "create") {
        await createResource(input);
      } else if (emp && Object.keys(input).length > 0) {
        await updateResource(emp.id, input);
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!emp) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteResource(emp.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  const resourceNoun = "employee";
  const title =
    mode === "create"
      ? `Add ${resourceNoun}`
      : `Edit ${resourceNoun} · ${emp?.name ?? ""}`;

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">{title}</div>
        <div style={{ padding: "0 12px 8px", fontSize: 11, color: "var(--text-tertiary)" }}>
          {isInstall ? "crfdf_InstallationEmployees" : "crfdf_employee1"} · admin
        </div>

        <div className="form-field">
          <div className="form-field__label">Name</div>
          <input
            className="form-field__input"
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {!isInstall && (
          <div className="form-field">
            <div className="form-field__label">Department</div>
            <select
              className="form-field__select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {deptList.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {isInstall && (
          <>
            <div className="form-field">
              <div className="form-field__label">Region</div>
              <div style={{ display: "inline-flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--lumineo-navy)" }}>
                {([["WK", false], ["NEK", true]] as const).map(([lbl, val]) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => onRegionChange(val)}
                    style={{
                      padding: "6px 16px",
                      fontSize: 12,
                      fontWeight: 600,
                      background: region === val ? "var(--lumineo-navy)" : "#fff",
                      color: region === val ? "#fff" : "var(--lumineo-navy)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <div className="form-field__label">Location</div>
              <select
                className="form-field__select"
                value={location}
                onChange={(e) => setLocation(Number(e.target.value))}
              >
                {locOptions.map((v) => (
                  <option key={v} value={v}>{INSTALL_LOCATIONS[v]}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <div className="form-field__label">Position on schedule</div>
              <input
                className="form-field__input"
                type="number"
                min="0"
                step="1"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <div className="form-field">
              <div className="form-field__label">Truck</div>
              <input
                className="form-field__input"
                type="text"
                value={truck}
                placeholder="none"
                onChange={(e) => setTruck(e.target.value)}
              />
            </div>

            <div className="form-field">
              <div className="form-field__label">Certified Crane Operator</div>
              <label
                style={{
                  background: "var(--input-bg)",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input type="checkbox" checked={cco} onChange={(e) => setCco(e.target.checked)} />
                <span style={{ fontSize: 12 }}>Show the CCO badge beside this name</span>
              </label>
            </div>
          </>
        )}

        {!isInstall && mode === "edit" && emp && (
          <div className="form-field" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div className="form-field__label">Assist Installation</div>
            {currentAssist ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Lent to <strong>{currentAssist.regionIsNek ? "NEK" : "WK"}</strong> this week
                  {currentAssist.days.length
                    ? ` · ${currentAssist.days
                        .map((d) => {
                          const h = currentAssist.halves[d];
                          return h ? `${WEEKDAYS[d]} ${h.toUpperCase()}` : WEEKDAYS[d];
                        })
                        .join(", ")}`
                    : " · all week"}
                  . Their production days are greyed and they appear on that install board.
                </div>
                {editingAssist ? (
                  <>
                    <AssistDayGrid value={assistDayHalf} setDay={setDayHalf} />
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      Turn a day off to stop lending it; set AM/PM for a half-day. Removing
                      every day ends the assist.
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => setEditingAssist(false)}
                      >
                        Cancel
                      </button>
                      <button className="btn-primary" disabled={busy} onClick={onSaveAssistEdit}>
                        {busy
                          ? "Saving…"
                          : assistDayHalf.size === 0
                            ? "Remove assist"
                            : "Save changes"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-secondary" disabled={busy} onClick={startEditAssist}>
                      Edit days
                    </button>
                    <button className="btn-secondary" disabled={busy} onClick={onRemoveAssist}>
                      Remove assist
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  Temporarily lend this person to an install schedule for the week of{" "}
                  {format(startOfWeek(weekStart, { weekStartsOn: 1 }), "MMM d")}.
                </div>
                <div style={{ display: "inline-flex", borderRadius: 5, overflow: "hidden", border: "1px solid var(--lumineo-navy)", alignSelf: "flex-start" }}>
                  {([["WK", false], ["NEK", true]] as const).map(([lbl, val]) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setAssistRegionNek(val)}
                      style={{
                        padding: "6px 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        background: assistRegionNek === val ? "var(--lumineo-navy)" : "#fff",
                        color: assistRegionNek === val ? "#fff" : "var(--lumineo-navy)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={assistAllWeek}
                    onChange={(e) => setAssistAllWeek(e.target.checked)}
                  />
                  All week
                </label>
                {!assistAllWeek && (
                  <>
                    <AssistDayGrid value={assistDayHalf} setDay={setDayHalf} />
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      Pick AM or PM for a half-day — they stay on production the other half.
                    </div>
                  </>
                )}
                <button
                  className="btn-primary"
                  disabled={busy || (!assistAllWeek && assistDayHalf.size === 0)}
                  onClick={onAssign}
                >
                  {busy ? "Assigning…" : "Assign to Installation"}
                </button>
              </div>
            )}
          </div>
        )}

        {err && (
          <div style={{ padding: "0 12px", fontSize: 11, color: "var(--lumineo-red)" }}>
            {err}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          {mode === "edit" && (
            <button className="btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : mode === "create" ? "Add" : "Save"}
          </button>
        </div>
      </div>

      {confirmDelete && emp && (
        <ConfirmDialog
          title={`Delete ${resourceNoun}?`}
          message={`Permanently delete ${emp.name} from the roster? This can't be undone.`}
          confirmLabel="Delete"
          danger
          busy={busy}
          onConfirm={onConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/** Weekday picker for an assist assignment: each day toggles on/off (off =
 *  removed) and, when on, carries an All / AM / PM half. Shared by the create
 *  and edit-days flows. */
function AssistDayGrid({
  value,
  setDay,
}: {
  value: Map<number, AssistHalf>;
  setDay: (day: number, half: AssistHalf | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {WEEKDAYS.map((lbl, i) => {
        const half = value.get(i);
        const on = half !== undefined;
        return (
          <div
            key={lbl}
            style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch" }}
          >
            <button
              type="button"
              onClick={() => setDay(i, on ? null : "full")}
              style={{
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 4,
                border: "1px solid var(--lumineo-navy)",
                background: on ? "var(--lumineo-navy)" : "#fff",
                color: on ? "#fff" : "var(--lumineo-navy)",
                cursor: "pointer",
              }}
            >
              {lbl}
            </button>
            {on && (
              <div
                style={{
                  display: "inline-flex",
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                {(
                  [
                    ["All", "full"],
                    ["AM", "am"],
                    ["PM", "pm"],
                  ] as const
                ).map(([t, val]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDay(i, val)}
                    style={{
                      flex: 1,
                      padding: "3px 6px",
                      fontSize: 10,
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      background: (half ?? "full") === val ? "var(--lumineo-navy)" : "#fff",
                      color: (half ?? "full") === val ? "#fff" : "var(--text-secondary)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
