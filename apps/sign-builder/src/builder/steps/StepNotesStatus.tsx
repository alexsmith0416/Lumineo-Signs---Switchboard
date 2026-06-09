// Final form card — notes (free text) + the spec's lifecycle status. Lives
// after all the cascade steps so users see it at the end of the form.

import { useSpec } from "../../app/SpecContext";
import type { SignSpecStatus } from "../../domain/SignSpec";

const STATUSES: SignSpecStatus[] = ["Draft", "Submitted", "Approved", "Built"];

export function StepNotesStatus() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-twocol">
        <span>Notes</span>
        <span>Status</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__twocol" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
          <textarea
            className="lum-input"
            rows={4}
            value={spec.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Internal notes — install context, customer requests, dependencies…"
            style={{ resize: "vertical", minHeight: 90 }}
          />
          <select
            className="lum-select"
            value={spec.status}
            onChange={(e) => update({ status: e.target.value as SignSpecStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
