import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import type { ActivePlacement, TaskCompletionRow } from "../../services/dataverse-live";
import JobTaskPicker from "../JobTaskPicker";
import JobSchedulePanel from "../JobSchedulePanel";
import ProductionStepperSection from "../ProductionStepperSection";
import { JobTargetsSection } from "../JobTargets";
import { JobBadge } from "./JobsGrid";
import { useJobTrackingStore } from "../../store/job-tracking-store";
import { COMPLETE_STATUSES, INSTALL_STATUSES, isHoldStatus } from "../../services/job-status";
import { useFieldOptionsStore } from "../../store/field-options-store";
import { builtinOptions } from "./field-options";
import { useCurrentUser } from "../../services/current-user";
import { useCustomFieldStore } from "../../store/custom-field-store";
import { describeFormula, linkFor } from "../../services/custom-fields";
import CustomValueEditor from "./CustomValueEditor";
import { OptionBadges } from "./JobsGrid";
import { canEditJobField, type JobEditAccess } from "../../services/job-edit-access";
import { AutoStatusTag } from "./ShopFloorHistory";
import { JobFlowJobSection } from "../JobFlowEditor";
import { useJobSteps } from "../../hooks/useJobSteps";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/**
 * A job opened from the Jobs list. It is built from the SAME sections the boards'
 * job editor uses, so the list and the Weekly Scheduler stay one system:
 *  - Production stepper — completing / re-opening / "Set active" writes the
 *    shared stepper stores and queues the BC Project Planning state push
 *    (store/bc-stepper-push.ts), exactly as it does from a board card.
 *  - Install Dates (release / scheduled install / red date) — the shared
 *    job-schedule store; the boards and the Jobs columns update at once.
 *  - Where the job sits on the Production / Installation / Shipping boards.
 * Tracking fields are shown here as a summary; editors change them in the grid
 * (jobs-editable.ts).
 * The name can be edited: it defaults to BC's ship-to customer name.
 */
export default function JobsJobPanel({
  row,
  edit,
  canSeeMoney,
  onClose,
}: {
  row: JobRow;
  /** What this login may change: everything, or only its granted fields. */
  edit: JobEditAccess;
  /** $ access — Currency custom fields are hidden without it. */
  canSeeMoney: boolean;
  onClose: () => void;
}) {
  const [placements, setPlacements] = useState<ActivePlacement[] | null>(null);
  useEffect(() => {
    if (!LIVE) {
      setPlacements([]);
      return;
    }
    let alive = true;
    void import("../../services/dataverse-live")
      .then((m) => m.jobPlacements(row.jobNo))
      .then((p) => alive && setPlacements(p))
      .catch(() => alive && setPlacements([]));
    return () => {
      alive = false;
    };
  }, [row.jobNo]);

  const facts: [string, string][] = (
    [
      ["Order date", fmt(row.orderDate) && `${fmt(row.orderDate)}${row.releaseDate ? " (released)" : ""}`],
      ["DIP", row.dip != null ? `${row.dip} days${row.doh ? ` · ${row.doh} on hold · actual ${row.actualDip ?? 0}` : ""}` : ""],
      ["Mfg final date", fmt(row.mfgFinalDate)],
      ["Expeditor", fmt(row.expeditor)],
      ["Hold", row.holdReason ? `${row.holdReason}${row.dateToHold ? ` since ${fmt(row.dateToHold)}` : ""}${row.dateOffHold ? ` · off ${fmt(row.dateOffHold)}` : ""}` : ""],
      ["Sales", row.sales],
      ["Location", [row.location, row.region].filter(Boolean).join(" · ")],
      ["Vendor", [row.vendor, row.po && `PO ${row.po}`, row.vendorStatus].filter(Boolean).join(" · ")],
      ["Storage", row.storageLocation],
      ["Date installed", fmt(row.dateInstalled)],
      ["Date to Admin", fmt(row.dateToAdmin)],
      ["Date invoiced", fmt(row.dateInvoiced)],
      ["UL sign", row.ulSign ? "Yes" : ""],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel slide-over__panel--wide" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <span>
            {row.jobNo}
            {row.name && ` · ${row.name}`}
          </span>
        </div>

        <div className="slide-over__body jobs-jobpanel">
          <div className="jobs-jobpanel__status">
            {canEditJobField(edit, "status") ? <StatusPicker row={row} /> : <JobBadge field="status" value={row.status} />}
            <AutoStatusTag jobNo={row.jobNo} auto={row.statusAuto} canDismiss={canEditJobField(edit, "status")} />
            {!row.inBc && <span className="jobs-tag jobs-tag--warn">not in BC sync</span>}
            {!row.tracked && <span className="jobs-jobpanel__muted">New BC job — no tracking details yet.</span>}
          </div>
          <JobNameField row={row} canEdit={canEditJobField(edit, "job")} />
          {row.description && <p className="jobs-jobpanel__desc">{row.description}</p>}

          {facts.length > 0 && (
            <dl className="jobs-jobpanel__facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {row.notes && <p className="jobs-jobpanel__notes">{row.notes}</p>}

          <CustomFieldsSection row={row} edit={edit} canSeeMoney={canSeeMoney} />

          <div className="form-field form-field--block">
            <div className="jobcard__label">On the boards</div>
            {placements === null ? (
              <span className="jobs-jobpanel__muted">Loading…</span>
            ) : placements.length === 0 ? (
              <span className="jobs-jobpanel__muted">Not on the Production, Installation or Shipping boards.</span>
            ) : (
              <div className="active-job__placements">
                {placements.map((p, i) => (
                  <span key={i} className={`active-chip active-chip--${p.kind}`}>
                    {p.label} · {format(p.date, "EEE MMM d")}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ShopFloorTicks jobNo={row.jobNo} />

          {row.inBc && (
            <>
              <ProductionStepperSection jobNo={row.jobNo} />
              <JobFlowForJob jobNo={row.jobNo} canEdit={canEditJobField(edit, "stepper") || canEditJobField(edit, "status")} />
              <JobTargetsSection jobNo={row.jobNo} />
              {/* Edits four dates at once, so full editors only — a login granted
                  one of those dates changes it in the list's own column. */}
              <JobSchedulePanel jobNo={row.jobNo} readOnly={!edit.all} />
              <div className="form-field form-field--block">
                <JobTaskPicker jobNo={row.jobNo} kind="production" currentDescriptions={[]} disabled onChange={() => {}} />
              </div>
            </>
          )}
        </div>

        <div className="users-admin__footer">
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** The job's custom field values — each editable when this login may edit that field. */
function CustomFieldsSection({ row, edit, canSeeMoney }: { row: JobRow; edit: JobEditAccess; canSeeMoney: boolean }) {
  const allDefs = useCustomFieldStore((s) => s.defs);
  const defs = canSeeMoney ? allDefs : allDefs.filter((d) => d.type !== "currency");
  const values = useJobTrackingStore((s) => s.tracks.find((t) => t.jobNo === row.jobNo)?.customValues);
  const setCustomValue = useJobTrackingStore((s) => s.setCustomValue);
  if (!defs.length) return null;
  const shown = (row as unknown as Record<string, unknown>);
  return (
    <div className="form-field form-field--block">
      <div className="jobcard__label">Custom fields</div>
      <div className="cf-panel">
        {defs.map((d) => {
          const v = shown[d.key];
          const text = typeof v === "number" ? (d.type === "currency" ? `$${v.toLocaleString("en-US")}` : v.toLocaleString("en-US")) : String(v ?? "");
          return (
            <div key={d.key} className="cf-panel__row">
              <div className="cf-panel__label" title={d.type === "formula-date" && d.formula ? describeFormula(d.formula, defs) : undefined}>
                {d.label}
              </div>
              <div className="cf-panel__value">
                {canEditJobField(edit, d.key) && d.type !== "formula-date" ? (
                  <CustomValueEditor def={d} value={values?.[d.key]} onSave={(nv) => void setCustomValue(row.jobNo, d.key, nv)} />
                ) : d.type === "select" || d.type === "multiselect" ? (
                  <OptionBadges def={d} value={text} />
                ) : d.type === "bool" ? (
                  v ? "Yes" : ""
                ) : d.type === "date" || d.type === "formula-date" ? (
                  fmt(text) || <span className="jobs-jobpanel__muted">—</span>
                ) : linkFor(d.type, text) ? (
                  <a className="jobs-link" href={linkFor(d.type, text)} target="_blank" rel="noreferrer">{text}</a>
                ) : (
                  text || <span className="jobs-jobpanel__muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Current Status. Picking one runs the status automation (store setStatus). */
function StatusPicker({ row }: { row: JobRow }) {
  const setStatus = useJobTrackingStore((s) => s.setStatus);
  const { fullName, upn } = useCurrentUser();
  // The status list in its edited order ("Edit field…" on the Current Status header).
  const statusOverride = useFieldOptionsStore((s) => s.overrides.status);
  const list = builtinOptions("status", statusOverride);
  const options = list.includes(row.status) ? list : [row.status, ...list];
  const hint = (s: string) =>
    COMPLETE_STATUSES.has(s)
      ? "completes every step"
      : INSTALL_STATUSES.has(s)
        ? "completes production"
        : isHoldStatus(s)
          ? "stamps Date to Hold"
          : "";
  return (
    <select
      className="form-field__input jobs-jobpanel__status-select"
      value={row.status}
      title="Complete statuses complete every stepper step; Installation statuses complete production; holds stamp Date to Hold / Date off Hold"
      onChange={(e) => void setStatus(row.jobNo, e.target.value, fullName || upn || "Unknown")}
    >
      {options.map((s) => (
        <option key={s} value={s} disabled={s === "Not tracked yet"}>
          {s}
          {hint(s) && ` — ${hint(s)}`}
        </option>
      ))}
    </select>
  );
}

/** The job's name: BC's ship-to customer by default, renamable by editors. */
function JobNameField({ row, canEdit }: { row: JobRow; canEdit: boolean }) {
  const renameJob = useJobTrackingStore((s) => s.renameJob);
  const [draft, setDraft] = useState<string | null>(null);
  const renamed = row.name !== row.defaultName;
  const save = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    // Typing the default name back (or clearing it) means "use BC's".
    if (next !== row.name) void renameJob(row.jobNo, next === row.defaultName ? "" : next);
  };

  return (
    <div className="form-field form-field--block">
      <div className="jobcard__label">Job name</div>
      {draft !== null ? (
        <input
          className="form-field__input"
          autoFocus
          value={draft}
          placeholder={row.defaultName || "Job name"}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setDraft(null);
          }}
        />
      ) : (
        <div className="jobs-jobpanel__name">
          <span>{row.name || <span className="jobs-jobpanel__muted">No name in BC</span>}</span>
          {canEdit && (
            <button className="jobs-jobpanel__link" onClick={() => setDraft(row.name)}>
              Rename
            </button>
          )}
          {canEdit && renamed && (
            <button className="jobs-jobpanel__link" onClick={() => void renameJob(row.jobNo, "")}>
              Use BC name{row.defaultName ? ` (${row.defaultName})` : ""}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function fmt(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "MMM d, yyyy") : "";
}

/** ▸ Job flow for a job: its stepper steps feed the flow (services/job-flow.ts). */
function JobFlowForJob({ jobNo, canEdit }: { jobNo: string; canEdit: boolean }) {
  const { steps } = useJobSteps(jobNo);
  return <JobFlowJobSection jobNo={jobNo} steps={steps} canEdit={canEdit} />;
}

/** "Task complete" ticks from BC job punches for this job, newest first, with
 *  what the app did with each (completed a department, moved the status, or
 *  why it skipped). Hidden when there are none. Live only. */
function ShopFloorTicks({ jobNo }: { jobNo: string }) {
  const [ticks, setTicks] = useState<TaskCompletionRow[]>([]);
  useEffect(() => {
    if (!LIVE) return;
    let alive = true;
    void import("../../services/dataverse-live")
      .then((m) => m.fetchTaskCompletionsForJob(jobNo))
      .then((rows) => alive && setTicks(rows.slice(0, 10)))
      .catch(() => alive && setTicks([]));
    return () => {
      alive = false;
    };
  }, [jobNo]);
  if (!ticks.length) return null;
  return (
    <div className="form-field form-field--block">
      <div className="jobcard__label">Shop floor · Task complete</div>
      <ul className="shopfloor-ticks">
        {ticks.map((t) => (
          <li key={t.id}>
            <div className="shopfloor-ticks__top">
              <strong>{t.resourceName || t.resourceNo}</strong>
              <span>
                {t.jobTaskNo}
                {t.taskDescription && ` · ${t.taskDescription}`}
              </span>
              <span className="shopfloor-ticks__when">{t.completedAt ? format(t.completedAt, "MMM d, h:mm a") : ""}</span>
            </div>
            <div className={`shopfloor-ticks__result shopfloor-ticks__result--${t.state || "pending"}`}>
              {t.state === "pending" || !t.state ? "Waiting to be applied…" : t.result}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

