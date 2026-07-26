/**
 * Batch schedule list — the "hub" of Multiple-jobs mode. Shows the staged jobs
 * (each already configured in the create panel), lets the user prioritize them
 * by dragging up/down or sorting (release date / production-complete / install
 * window / hours), then schedules them all top-to-bottom.
 */
import { useState } from "react";
import { format } from "date-fns";
import {
  reorderBatch,
  sortBatch,
  type BatchItem,
  type BatchSortKey,
  type SortDir,
} from "../services/batch-schedule";

const SORTS: { key: BatchSortKey; label: string }[] = [
  { key: "release", label: "Release date" },
  { key: "production", label: "Production complete" },
  { key: "install", label: "Install window" },
  { key: "hours", label: "Hours" },
];

interface Props {
  items: BatchItem[];
  onChange: (items: BatchItem[]) => void;
  onRemove: (id: string) => void;
  onAddAnother: () => void;
  onScheduleAll: () => void;
  onClose: () => void;
  busy?: boolean;
}

export default function BatchListPanel({
  items,
  onChange,
  onRemove,
  onAddAnother,
  onScheduleAll,
  onClose,
  busy,
}: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<BatchSortKey>("release");
  const [dir, setDir] = useState<SortDir>("asc");

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          Schedule list · {items.length} job{items.length === 1 ? "" : "s"}
        </div>
        <div style={{ padding: "0 12px 8px", fontSize: 11, color: "var(--text-secondary)" }}>
          Order the jobs however you want — drag to reorder, or sort. They schedule
          top-to-bottom (top first).
        </div>

        <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Sort by</span>
          <select
            className="form-field__select"
            style={{ flex: 1, fontSize: 12 }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as BatchSortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: "5px 9px", fontSize: 12 }}
            onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
            title="Toggle ascending / descending"
          >
            {dir === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: "5px 11px", fontSize: 12 }}
            onClick={() => onChange(sortBatch(items, sortKey, dir))}
          >
            Sort
          </button>
        </div>

        <div className="slide-over__body">
          {items.length === 0 ? (
            <div className="jtp__note" style={{ padding: 12 }}>
              No jobs staged yet — add one below.
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: "0 12px", margin: 0 }}>
              {items.map((it, i) => (
                <li
                  key={it.id}
                  className={"batch-item" + (dragIdx === i ? " batch-item--dragging" : "")}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null) onChange(reorderBatch(items, dragIdx, i));
                    setDragIdx(null);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                >
                  <span className="batch-item__grip" title="Drag to reorder" aria-hidden>
                    ⠿
                  </span>
                  <span className="batch-item__num">{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {it.draft.jobNo} · {it.draft.customerName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.draft.planningLineDescription.split("\n").join(" • ")}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {it.hours}h ·{" "}
                      {it.employeeName
                        ? `→ ${it.employeeName}${it.start ? ` ${format(it.start, "MMM d")}` : " · next open"}`
                        : "auto-schedule"}
                      {it.productionComplete ? ` · prod ${format(it.productionComplete, "MMM d")}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="group-members__remove"
                    title="Remove from list"
                    onClick={() => onRemove(it.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button type="button" className="btn-secondary" disabled={busy} onClick={onAddAnother}>
            + Add job
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || items.length === 0}
            onClick={onScheduleAll}
          >
            {busy ? "Scheduling…" : `Schedule ${items.length} job${items.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
