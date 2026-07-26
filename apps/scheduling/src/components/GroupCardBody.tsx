import { useState } from "react";
import { useJobSearch } from "../hooks/useJobSearch";
import { isInstallResource, isProductionResource } from "../services/planning-line-mapping";
import { type UseScheduleStore, useScheduleStore } from "../store/schedule-store";
import { groupPayloadFits, newMemberId, type GroupMember } from "../services/group-card";
import JobTaskChooser, { type TaskChoice } from "./JobTaskChooser";

/**
 * Shared editor body for a grouped job card — title + optional description + a
 * list of member BC jobs (added via BC search). Used by AddJobPanel's "group"
 * kind (create) and GroupPanel (view / edit). Purely presentational: the parent
 * owns the title/description/members state and persistence.
 */
export default function GroupCardBody({
  title,
  setTitle,
  description,
  setDescription,
  members,
  onAddMember,
  onRemoveMember,
  readOnly = false,
  useStore = useScheduleStore,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  members: GroupMember[];
  onAddMember: (m: GroupMember) => void;
  onRemoveMember: (id: string) => void;
  readOnly?: boolean;
  useStore?: UseScheduleStore;
}) {
  const kind = useStore((s) => s.dataSource.kind);
  const { query, setQuery, results, loading } = useJobSearch();
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  // A job picked from search whose tasks are being chosen before it's added.
  // Tasks start UNchecked so the user explicitly selects what belongs in the
  // group (a job's planning lines are otherwise added wholesale).
  const [pending, setPending] = useState<{
    jobNo: string;
    customerName: string;
    jobDesc: string;
    lines: { description: string; estimatedHours: number }[];
  } | null>(null);
  // Running selection (BC tasks + any custom tasks) from the task chooser.
  const [choice, setChoice] = useState<TaskChoice | null>(null);

  const pickResult = (
    jobNo: string,
    customerName: string,
    jobDesc: string,
    mapped: { resourceNo?: string; description: string; estimatedHours: number }[],
  ) => {
    const lines = mapped
      .filter((l) =>
        kind === "production"
          ? isProductionResource(l.resourceNo ?? "")
          : isInstallResource(l.resourceNo ?? ""),
      )
      .map((l) => ({ description: l.description, estimatedHours: l.estimatedHours }));
    setPending({ jobNo, customerName, jobDesc, lines });
    setChoice(null);
    setQuery("");
  };

  const commitPending = () => {
    if (!pending) return;
    const descriptions = choice?.descriptions ?? [];
    const hasSel = descriptions.length > 0;
    // A job with planning lines requires at least one chosen task (BC or custom);
    // a job with no BC lines is added whole (its description becomes the task
    // text, 0h) unless the user typed custom tasks.
    if (pending.lines.length > 0 && !hasSel) return;
    const next: GroupMember = {
      id: newMemberId(members.length),
      jobNo: pending.jobNo,
      customerName: pending.customerName,
      task: hasSel ? descriptions.join("\n") : pending.jobDesc,
      estimatedHours: hasSel ? (choice?.totalHours ?? 0) : 0,
    };
    // The payload is stored in a 2000-char Dataverse column; refuse an add that
    // would overflow it, since a truncated payload loses every member on reload.
    if (!groupPayloadFits({ title, description, members: [...members, next] })) {
      setFull(true);
      window.setTimeout(() => setFull(false), 4000);
      return;
    }
    onAddMember(next);
    setJustAdded(pending.jobNo);
    setPending(null);
    setChoice(null);
    window.setTimeout(() => setJustAdded(null), 1200);
  };

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="form-field" style={{ margin: 0 }}>
        <div className="form-field__label">Group title</div>
        <input
          className="form-field__input"
          placeholder="e.g. Downtown punch-list, Waiting on parts…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={readOnly}
          autoFocus={!readOnly}
        />
      </div>

      <div className="form-field" style={{ margin: 0 }}>
        <div className="form-field__label">Description (optional)</div>
        <textarea
          className="form-field__input"
          rows={2}
          placeholder="Shown on the card; hidden from non-editors when left blank."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={readOnly}
          style={{ resize: "vertical", fontFamily: "inherit", width: "100%" }}
        />
      </div>

      <div>
        <div className="form-field__label" style={{ marginBottom: 6 }}>
          Jobs in this group ({members.length})
        </div>
        <div className="group-members__list">
          {members.length === 0 ? (
            <div className="jtp__note">No jobs yet{readOnly ? "." : " — search below to add."}</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="group-members__row">
                <div className="group-members__main">
                  <span className="group-members__no">{m.jobNo}</span>
                  <span className="group-members__cust">{m.customerName}</span>
                  {m.task && <span className="group-members__task">{m.task.split("\n").join(" • ")}</span>}
                </div>
                <div className="group-members__side">
                  {m.estimatedHours > 0 && <span className="group-members__hours">{m.estimatedHours}h</span>}
                  {!readOnly && (
                    <button
                      type="button"
                      className="group-members__remove"
                      title="Remove from group"
                      onClick={() => onRemoveMember(m.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {!readOnly && (
        <div>
          <div className="form-field__label" style={{ marginBottom: 6 }}>
            Add a job
          </div>

          {pending ? (
            // A job is picked — choose which of its tasks join the group. Tasks
            // start unchecked; the Add button stays off until one is selected
            // (a job with no BC lines can be added whole).
            <div style={{ border: "1px solid var(--border)", borderRadius: 4, padding: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {pending.jobNo} — {pending.customerName}
                </div>
                <button
                  type="button"
                  className="group-members__remove"
                  title="Cancel"
                  onClick={() => {
                    setPending(null);
                    setChoice(null);
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ marginTop: 8 }}>
                <JobTaskChooser key={pending.jobNo} lines={pending.lines} onChange={setChoice} />
              </div>
              {(() => {
                const n = choice?.descriptions.length ?? 0;
                return (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ width: "100%", marginTop: 8 }}
                    disabled={pending.lines.length > 0 && n === 0}
                    onClick={commitPending}
                  >
                    {pending.lines.length === 0 && n === 0
                      ? "Add job to group"
                      : `Add ${n || ""} task${n === 1 ? "" : "s"} to group`}
                  </button>
                );
              })()}
            </div>
          ) : (
            <>
              <input
                className="form-field__input"
                style={{ width: "100%", borderRadius: 4 }}
                placeholder="Search BC job number (e.g. J103101 or 103101)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {loading && <div className="loading">Searching…</div>}
              {justAdded && <div className="group-members__added">Added {justAdded} ✓</div>}
              {full && (
                <div className="jtp__note" style={{ color: "var(--lumineo-red)" }}>
                  This group is full — remove a job or start another group card.
                </div>
              )}
              {results.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
                  {results.map((r) => (
                    <li key={r.job.jobNo} style={{ marginBottom: 4 }}>
                      <button
                        className="btn-secondary"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() =>
                          pickResult(r.job.jobNo, r.job.customerName, r.job.description ?? "", r.mappedLines)
                        }
                      >
                        <strong>{r.job.jobNo}</strong> — {r.job.customerName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
