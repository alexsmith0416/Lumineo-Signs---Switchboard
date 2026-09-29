import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import type { ActivePlacement } from "../../services/dataverse-live";
import JobTaskPicker from "../JobTaskPicker";
import JobSchedulePanel from "../JobSchedulePanel";
import ProductionStepperSection from "../ProductionStepperSection";
import { JobTargetsSection } from "../JobTargets";
import { JobBadge } from "./JobsGrid";

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
 * Tracking fields (hold, vendor, expeditor…) are shown read-only until Phase 2.
 */
export default function JobsJobPanel({ row, canEdit, onClose }: { row: JobRow; canEdit: boolean; onClose: () => void }) {
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
      ["Order date", fmt(row.orderDate)],
      ["DIP", row.dip != null ? `${row.dip} days` : ""],
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
            <JobBadge field="status" value={row.status} />
            {row.statusSource === "override" && <span className="jobs-tag">override</span>}
            {!row.inBc && <span className="jobs-tag jobs-tag--warn">not in BC sync</span>}
            {!row.tracked && <span className="jobs-jobpanel__muted">New BC job — no tracking details yet.</span>}
          </div>
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

          {row.inBc && (
            <>
              <ProductionStepperSection jobNo={row.jobNo} />
              <JobTargetsSection jobNo={row.jobNo} />
              <JobSchedulePanel jobNo={row.jobNo} readOnly={!canEdit} />
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

function fmt(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), "MMM d, yyyy") : "";
}
