/**
 * Task chooser for the ADD flows (Job Queue + group card). Shows a job's BC
 * planning lines as a checklist, plus a "+ Custom task" row at the end so the
 * user can type a one-off task name + its estimated hours. Custom tasks sit
 * alongside the selected BC tasks and contribute to the total hours.
 *
 * The caller supplies the already-filtered lines (each with an optional
 * departmentId) and receives the running selection via onChange.
 */
import { useState } from "react";

export interface ChooserLine {
  description: string;
  estimatedHours: number;
  /** Mapped department for this BC line (used to color/route the resulting
   *  card). Custom tasks have none. */
  departmentId?: string | null;
}

export interface TaskChoice {
  /** Task texts in order — selected BC lines first, then custom tasks. */
  descriptions: string[];
  /** Summed estimated hours across selected BC lines + custom tasks. */
  totalHours: number;
  /** First selected BC line's department (null when only custom tasks). */
  departmentId: string | null;
}

interface CustomTask {
  description: string;
  hours: number;
}

interface Props {
  /** BC planning lines already filtered for this board's kind. */
  lines: ChooserLine[];
  onChange: (choice: TaskChoice) => void;
}

const row = (on: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: 6,
  borderRadius: 4,
  marginBottom: 4,
  cursor: "pointer",
  background: on ? "var(--label-bg)" : "var(--bg-secondary)",
  border: `1px solid ${on ? "var(--lumineo-navy)" : "var(--border)"}`,
});

export default function JobTaskChooser({ lines, onChange }: Props) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [custom, setCustom] = useState<CustomTask[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftHours, setDraftHours] = useState("8");

  const emit = (nextPicked: Set<number>, nextCustom: CustomTask[]) => {
    const pickedLines = lines.filter((_, i) => nextPicked.has(i));
    const descriptions = [
      ...pickedLines.map((l) => l.description),
      ...nextCustom.map((c) => c.description),
    ];
    const totalHours =
      pickedLines.reduce((s, l) => s + l.estimatedHours, 0) +
      nextCustom.reduce((s, c) => s + c.hours, 0);
    onChange({
      descriptions,
      totalHours,
      departmentId: pickedLines[0]?.departmentId ?? null,
    });
  };

  const toggle = (i: number) => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setPicked(next);
    emit(next, custom);
  };

  const addCustom = () => {
    const text = draftText.trim();
    const hours = Number(draftHours);
    if (!text || Number.isNaN(hours) || hours <= 0) return;
    const next = [...custom, { description: text, hours }];
    setCustom(next);
    setDraftText("");
    setDraftHours("8");
    setAdding(false);
    emit(picked, next);
  };

  const removeCustom = (idx: number) => {
    const next = custom.filter((_, i) => i !== idx);
    setCustom(next);
    emit(picked, next);
  };

  return (
    <div>
      {lines.length === 0 && custom.length === 0 && (
        <div className="jtp__note" style={{ marginBottom: 4 }}>
          No BC planning lines for this job — add a custom task below, or add it as a whole job.
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {lines.map((l, idx) => {
          const on = picked.has(idx);
          return (
            <li key={idx} onClick={() => toggle(idx)} style={row(on)}>
              <span
                aria-hidden
                style={{ fontSize: 14, lineHeight: "16px", color: on ? "var(--lumineo-navy)" : "var(--text-tertiary)" }}
              >
                {on ? "☑" : "☐"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{l.description}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{l.estimatedHours}h</div>
              </div>
            </li>
          );
        })}

        {/* Custom tasks the user added — always "on", removable. */}
        {custom.map((c, idx) => (
          <li key={`c-${idx}`} style={row(true)}>
            <span aria-hidden style={{ fontSize: 14, lineHeight: "16px", color: "var(--lumineo-navy)" }}>
              ☑
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {c.description} <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>· custom</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.hours}h</div>
            </div>
            <button
              type="button"
              className="group-members__remove"
              title="Remove custom task"
              onClick={(e) => {
                e.stopPropagation();
                removeCustom(idx);
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* "+ Custom task" row at the end of the list. */}
      {adding ? (
        <div className="jtc-custom">
          <input
            className="form-field__input"
            style={{ width: "100%", borderRadius: 4, fontSize: 12 }}
            placeholder="Custom task description (e.g. Field measure)"
            value={draftText}
            autoFocus
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCustom();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Hours</label>
            <input
              className="form-field__input"
              style={{ width: 72, borderRadius: 4, fontSize: 12 }}
              type="number"
              min="0.25"
              step="0.25"
              value={draftHours}
              onChange={(e) => setDraftHours(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 12 }}
              disabled={!draftText.trim() || !(Number(draftHours) > 0)}
              onClick={addCustom}
            >
              Add task
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="jtc-custom-add" onClick={() => setAdding(true)}>
          + Custom task
        </button>
      )}
    </div>
  );
}
