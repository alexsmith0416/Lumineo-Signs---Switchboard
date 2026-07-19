import { format } from "date-fns";
import type { ActiveJob } from "../services/dataverse-live";
import JobTaskPicker from "./JobTaskPicker";
import ProductionStepperSection from "./ProductionStepperSection";
import JobSchedulePanel from "./JobSchedulePanel";

/**
 * Read-only job card for Sales / PM (and admins browsing Sales/PM). A job spans
 * many scheduled cards, so instead of the per-card editor this shows the same
 * job-level sections Production/Install users see when they open a card — the
 * Job tasks checklist, the production stepper (with the Completed log) and the
 * Install Dates — plus where/when the job is currently scheduled. Everything is
 * view-only: the stepper only accepts node clicks from admins, and the task list
 * + dates are disabled.
 */
export default function JobCardPanel({ job, onClose }: { job: ActiveJob; onClose: () => void }) {
  // Show the task checklist for the side the job actually has work on.
  const kind = job.placements.some((p) => p.kind === "production") ? "production" : "installation";

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          <span>
            {job.jobNo} · {job.customerName}
            <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--text-tertiary)" }}>· View only</span>
          </span>
        </div>

        <div className="slide-over__body">
          {job.placements.length > 0 && (
            <div className="form-field form-field--block">
              <div className="jobcard__label">Scheduled</div>
              <div className="active-job__placements">
                {job.placements.map((p, i) => (
                  <span key={i} className={`active-chip active-chip--${p.kind}`}>
                    {p.label} · {format(p.date, "EEE MMM d")}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="form-field form-field--block">
            <JobTaskPicker
              jobNo={job.jobNo}
              kind={kind}
              currentDescriptions={[]}
              disabled
              onChange={() => {}}
            />
          </div>

          <ProductionStepperSection jobNo={job.jobNo} />

          <JobSchedulePanel jobNo={job.jobNo} readOnly />
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}
        >
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
