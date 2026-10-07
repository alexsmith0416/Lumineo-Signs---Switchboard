// Jobs → History: the shop floor's "Task complete" ticks (BC job punches) and
// what each one did automatically — the department it completed, the step the
// job moved to, and the Current Status change — so the office can review every
// automatic move. Also the Auto tag a punch leaves on a job's status.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import type { JobRow } from "../../services/job-tracking";
import type { TaskCompletionRow } from "../../services/dataverse-live";
import { useJobTrackingStore } from "../../store/job-tracking-store";
import { useStatusRulesStore } from "../../store/status-rules-store";
import { tickOutcome } from "../../services/task-completion";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const DAYS = 30;

/** The Auto tag beside a status a shop-floor punch set. `canDismiss` adds the ×. */
export function AutoStatusTag({ jobNo, auto, canDismiss }: { jobNo: string; auto: string; canDismiss: boolean }) {
  if (!auto) return null;
  return (
    <span className="jobs-tag jobs-tag--auto" title={`Status moved automatically by a shop-floor punch (${auto})`}>
      auto
      {canDismiss && (
        <button
          type="button"
          className="jobs-tag__x"
          aria-label="Dismiss the auto tag"
          title="Dismiss (the status stays as it is)"
          onClick={(e) => {
            e.stopPropagation();
            void useJobTrackingStore.getState().dismissAuto(jobNo);
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

type Show = "all" | "moves" | "review" | "skipped";
const SHOW_LABELS: Record<Show, string> = { all: "All", moves: "Status moves", review: "Needs review", skipped: "Skipped" };

export function ShopFloorHistoryPanel({ rows, canDismiss, onOpenJob, onClose }: {
  /** The Jobs list's rows (for names and which Auto tags are still up). */
  rows: JobRow[];
  canDismiss: boolean;
  onOpenJob: (row: JobRow) => void;
  onClose: () => void;
}) {
  const [ticks, setTicks] = useState<TaskCompletionRow[] | null>(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState<Show>("all");
  // Pinned to the window under the button: the Jobs section clips anything
  // wider than itself, and this list is wider than the toolbar's right end.
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const place = () => {
      const r = ref.current?.parentElement?.getBoundingClientRect();
      if (r) setPos({ position: "fixed", top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), left: "auto" });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  const load = useCallback(() => {
    if (!LIVE) return;
    setError("");
    void import("../../services/dataverse-live")
      .then((m) => m.fetchRecentTaskCompletions(DAYS))
      .then(setTicks)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);
  const rules = useStatusRulesStore((s) => s.rules);
  useEffect(() => {
    void useStatusRulesStore.getState().load();
  }, []);

  const byJob = useMemo(() => new Map(rows.map((r) => [r.jobNo, r])), [rows]);
  // A job's Auto tag belongs to its newest tick that moved the status.
  const reviewIds = useMemo(() => {
    const ids = new Set<string>();
    const seen = new Set<string>();
    for (const t of ticks ?? []) {
      if (!t.statusTo || seen.has(t.jobNo)) continue;
      seen.add(t.jobNo);
      if (byJob.get(t.jobNo)?.statusAuto) ids.add(t.id);
    }
    return ids;
  }, [ticks, byJob]);

  const shown = (ticks ?? []).filter((t) =>
    show === "moves" ? !!t.statusTo : show === "review" ? reviewIds.has(t.id) : show === "skipped" ? t.state === "skipped" : true,
  );

  const markAll = () => {
    for (const r of rows) if (r.statusAuto) void useJobTrackingStore.getState().dismissAuto(r.jobNo);
  };
  const pending = rows.filter((r) => r.statusAuto).length;

  return (
    <div ref={ref} className="jobs-panel sfh" style={pos} onClick={(e) => e.stopPropagation()}>
      <div className="jobs-panel__head">
        <span>Shop-floor history · last {DAYS} days</span>
        <span className="jobs-panel__head-actions">
          <button type="button" className="jobs-panel__mini" onClick={load}>Reload</button>
          <button type="button" className="jobs-panel__x" onClick={onClose} aria-label="Close">✕</button>
        </span>
      </div>
      <div className="sfh__filters">
        {(Object.keys(SHOW_LABELS) as Show[]).map((k) => (
          <button key={k} type="button" className={`sfh__chip${show === k ? " sfh__chip--on" : ""}`} onClick={() => setShow(k)}>
            {SHOW_LABELS[k]}
            {k === "review" && pending > 0 && <span className="jobs-toolbar__count">{pending}</span>}
          </button>
        ))}
      </div>
      <div className="sfh__body">
        {!LIVE ? (
          <div className="jobs-panel__empty">History reads the live shop-floor ticks — open the deployed app to see it.</div>
        ) : error ? (
          <div className="jobs-panel__empty">Couldn't load the history: {error}</div>
        ) : !ticks ? (
          <div className="jobs-panel__empty">Loading…</div>
        ) : !shown.length ? (
          <div className="jobs-panel__empty">Nothing here for the last {DAYS} days.</div>
        ) : (
          <table className="sfh__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Job</th>
                <th>Resource</th>
                <th>Task</th>
                <th>Completed</th>
                <th>Moved to</th>
                <th>Current Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const row = byJob.get(t.jobNo);
                const o = tickOutcome(t, rules);
                return (
                  <tr key={t.id} className={t.state === "skipped" ? "sfh__row--skipped" : ""}>
                    <td className="sfh__when">
                      {t.completedAt ? format(t.completedAt, "M/d/yyyy") : ""}
                      <span>{t.completedAt ? format(t.completedAt, "h:mm a") : ""}{t.source ? ` · ${t.source}` : ""}</span>
                    </td>
                    <td>
                      {row ? (
                        <button type="button" className="sfh__job" onClick={() => onOpenJob(row)} title="Open the job">
                          {t.jobNo}
                        </button>
                      ) : (
                        t.jobNo
                      )}
                      {row?.name && <span className="sfh__sub">{row.name}</span>}
                    </td>
                    <td>{t.resourceName || t.resourceNo}</td>
                    <td>
                      {t.jobTaskNo}
                      {t.taskDescription && <span className="sfh__sub">{t.taskDescription}</span>}
                    </td>
                    {t.state === "pending" || !t.state ? (
                      <td colSpan={3} className="sfh__muted">Waiting to be applied…</td>
                    ) : t.state === "skipped" ? (
                      <td colSpan={3} className="sfh__skipped">Skipped — {t.result}</td>
                    ) : (
                      <>
                        <td>{o.department || <span className="sfh__muted">—</span>}</td>
                        <td>{o.nextDept || <span className="sfh__muted">—</span>}</td>
                        <td>
                          {o.statusTo ? (
                            <>
                              <strong>{o.statusTo}</strong>
                              <span className="sfh__sub">was {o.statusFrom}</span>
                            </>
                          ) : o.statusFrom ? (
                            <>
                              {o.statusFrom}
                              <span className="sfh__sub">unchanged</span>
                            </>
                          ) : (
                            <span className="sfh__muted">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="sfh__review">
                      {reviewIds.has(t.id) &&
                        (canDismiss ? (
                          <button
                            type="button"
                            className="sfh__reviewed"
                            onClick={() => void useJobTrackingStore.getState().dismissAuto(t.jobNo)}
                            title="Clear this job's Auto tag (the status stays as it is)"
                          >
                            ✓ Reviewed
                          </button>
                        ) : (
                          <span className="jobs-tag jobs-tag--auto">auto</span>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {canDismiss && pending > 0 && (
        <div className="jobs-panel__foot">
          <span className="sfh__muted">
            {pending} job{pending === 1 ? "" : "s"} with an Auto tag
          </span>
          <button type="button" className="jobs-panel__clear" onClick={markAll}>Mark all reviewed</button>
        </div>
      )}
    </div>
  );
}
