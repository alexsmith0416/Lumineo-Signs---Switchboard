import { useState } from "react";
import BcSyncDialog from "./jobs/BcSyncDialog";
import StatusBackfillDialog from "./jobs/StatusBackfillDialog";

/**
 * Settings → Business Central. Catch-up tools for the job list. Everyday
 * changes (completing a department, a status change, moving a card) already
 * reach BC as they're made, so these are only for bringing everything back in
 * line — e.g. after an import or an outage. Admin / Developer / Ops only (the
 * caller gates it).
 */
export default function BusinessCentralSection() {
  const [open, setOpen] = useState<"match" | "sync" | null>(null);
  return (
    <div className="settings-section">
      <div className="settings-section__title">Business Central</div>

      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">Match steppers to status</div>
          <div className="settings-row__desc">
            Completes the stepper steps each job's <strong>Current Status</strong> says are done — every step for the
            Complete statuses, the production steps for the Installation statuses. Shows the counts first. Changing a
            job's status already does this; use it to catch up jobs whose status was set another way.
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setOpen("match")}>
          Match Steppers
        </button>
      </div>

      <div className="settings-row">
        <div className="settings-row__text">
          <div className="settings-row__title">Sync every job to BC</div>
          <div className="settings-row__desc">
            Sends every tracked job's stepper status (Started / Complete) and scheduled dates to BC Project Planning.
            Only what changed since BC was last updated is sent. Everyday changes reach BC on their own; use this
            after <em>Match Steppers</em> or if BC looks out of step.
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={() => setOpen("sync")}>
          Sync to BC
        </button>
      </div>

      {open === "match" && <StatusBackfillDialog onClose={() => setOpen(null)} />}
      {open === "sync" && <BcSyncDialog onClose={() => setOpen(null)} />}
    </div>
  );
}
