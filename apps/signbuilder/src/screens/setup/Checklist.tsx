import { useState } from "react";
import type { Stage } from "../../domain/types";
import {
  addChecklistLine,
  ALL_CATEGORIES,
  checklistOf,
  deleteChecklistLine,
  moveChecklistLine,
  updateChecklistLine,
} from "../../setup/reference-ops";
import { useSetupStore } from "../../store/setup-store";
import { CommitInput } from "./setup-ui";

const STAGES: [Stage, string][] = [
  ["opportunity", "Opportunity"],
  ["job", "Job details"],
  ["later", "Later"],
  ["notAsked", "Not asked"],
];

/** Setup → Stage Checklist: what has to be known about a sign at each stage
 *  (opportunity / job), for every category or one — the reference list the
 *  questions are built against, with the questions that cover each detail. */
export default function Checklist() {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const [category, setCategory] = useState(ALL_CATEGORIES);

  if (!setup) return <div className="sbp-muted">Loading…</div>;
  const categories = [...setup.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const lines = checklistOf(setup, category);
  const groups = [...new Set(lines.map((l) => l.group))];
  const count = (c: string) => checklistOf(setup, c).length;
  const set = (lineNo: number, patch: Parameters<typeof updateChecklistLine>[2]) => replace(updateChecklistLine(setup, lineNo, patch), "Edit checklist line");
  // Question codes the categories' sign types actually have (to flag typos).
  const known = new Set(
    setup.questions.filter((q) => category === ALL_CATEGORIES || setup.signTypes.find((t) => t.code === q.signTypeCode)?.categoryCode === category).map((q) => q.code),
  );

  return (
    <div className="sbp-card" data-tour="checklist">
      <div className="sbp-row" style={{ gap: 8 }}>
        <select className="sbp-input" style={{ width: 280 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value={ALL_CATEGORIES}>Every category ({count(ALL_CATEGORIES)})</option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.description} ({count(c.code)})
            </option>
          ))}
        </select>
        <div className="sbp-spacer" />
        <button type="button" className="btn-secondary" onClick={() => replace(addChecklistLine(setup, category, groups.at(-1) ?? "General").setup, "Add checklist line")}>
          + Add line
        </button>
      </div>
      <p className="sbp-muted" style={{ fontSize: 12 }}>
        What has to be known about a sign by each stage. <b>Questions</b> lists the question codes that cover the detail (separated by |) — codes no sign type of
        the category has are flagged.
      </p>
      {lines.length === 0 && <div className="sbp-muted">No checklist lines here yet.</div>}
      {lines.length > 0 && (
        <table className="sbp-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Detail</th>
              <th>Stage</th>
              <th>In the form</th>
              <th>Questions</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const unknown = l.questionCodes
                .split("|")
                .map((c) => c.trim().toUpperCase())
                .filter((c) => c && !known.has(c));
              return (
                <tr key={l.lineNo}>
                  <td>
                    <CommitInput value={l.group} onCommit={(v) => set(l.lineNo, { group: v.trim() })} style={{ width: 130 }} />
                  </td>
                  <td>
                    <CommitInput value={l.detail} onCommit={(v) => set(l.lineNo, { detail: v })} style={{ minWidth: 260 }} />
                  </td>
                  <td>
                    <select className="sbp-input" value={l.stage} onChange={(e) => set(l.lineNo, { stage: e.target.value as Stage })}>
                      {STAGES.map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <CommitInput value={l.inForm} placeholder="Yes / New / Partly" onCommit={(v) => set(l.lineNo, { inForm: v.trim() })} style={{ width: 100 }} />
                  </td>
                  <td>
                    <CommitInput value={l.questionCodes} onCommit={(v) => set(l.lineNo, { questionCodes: v.trim().toUpperCase() })} style={{ width: 180 }} />
                    {unknown.length > 0 && <div style={{ fontSize: 10, color: "var(--status-red)" }}>not a question here: {unknown.join(", ")}</div>}
                  </td>
                  <td>
                    <CommitInput value={l.notes} onCommit={(v) => set(l.lineNo, { notes: v })} style={{ width: 200 }} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="sbp-icon-btn" disabled={i === 0} onClick={() => replace(moveChecklistLine(setup, l.lineNo, -1), "Move checklist line")}>
                      ↑
                    </button>
                    <button type="button" className="sbp-icon-btn" disabled={i === lines.length - 1} onClick={() => replace(moveChecklistLine(setup, l.lineNo, 1), "Move checklist line")}>
                      ↓
                    </button>
                    <button type="button" className="sbp-icon-btn" title="Delete the line" onClick={() => replace(deleteChecklistLine(setup, l.lineNo), "Delete checklist line")}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
