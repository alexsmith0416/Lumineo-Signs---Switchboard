import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import type { ScheduleLine } from "../engine/types";
import { evenSplit, lineHours, potFor } from "../services/split-hours";

interface SplitCardPanelProps {
  line: ScheduleLine;
  /** The board's current schedule — used to show what the OTHER parts already
   *  hold, so the total is measured against the whole pot, not just this card. */
  schedule: ScheduleLine[];
  onCancel: () => void;
  /** Commit the split. `partHours[0]` re-sizes this card; the rest become new
   *  cards auto-placed at the next opening. */
  onSplit: (partHours: number[]) => Promise<void> | void;
}

const fmtHours = (h: number): string => `${Number(h.toFixed(2))}h`;

/**
 * Split one card into sections that share the task's estimated-hours pot.
 *
 * The point is to schedule a job in chunks — work it, go do other jobs, come
 * back — WITHOUT re-booking the whole estimate each time. The parts always
 * divide the hours this card already holds; going over the task's estimate is
 * allowed but flagged.
 */
export default function SplitCardPanel({ line, schedule, onCancel, onSplit }: SplitCardPanelProps) {
  const pot = useMemo(() => potFor(line, schedule), [line, schedule]);
  const cardHours = lineHours(line);
  const [parts, setParts] = useState<string[]>(() =>
    evenSplit(cardHours, 2).map((h) => String(Number(h.toFixed(2)))),
  );
  const [busy, setBusy] = useState(false);

  const nums = parts.map((p) => {
    const n = Number(p.trim());
    return p.trim() === "" || Number.isNaN(n) ? 0 : n;
  });
  const partsTotal = nums.reduce((a, b) => a + b, 0);
  // What the whole task would hold: these parts plus any sibling parts that
  // aren't being re-cut here.
  const taskTotal = pot.otherParts + partsTotal;
  const overBy = Math.max(0, taskTotal - pot.pot);
  const leftInCard = Number((cardHours - partsTotal).toFixed(2));
  const valid = nums.every((n) => n > 0) && parts.length >= 2 && !busy;

  const setPart = (i: number, v: string) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? v : p)));

  const addPart = () =>
    setParts((prev) => evenSplit(cardHours, prev.length + 1).map((h) => String(Number(h.toFixed(2)))));

  const removePart = (i: number) =>
    setParts((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));

  const commit = async () => {
    setBusy(true);
    try {
      await onSplit(nums);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-scrim" onClick={onCancel} style={{ zIndex: 320 }}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", maxHeight: "85vh", width: 420 }}
      >
        <div className="modal-card__title">Split into sections</div>
        <div className="modal-card__body" style={{ padding: "0 0 10px" }}>
          <div style={{ fontWeight: 600 }}>
            {line.jobNo} · {line.customerName}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>
            {line.planningLineDescription}
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 12, marginTop: 6 }}>
            Schedule this task in chunks without re-booking its hours. Part 1 stays on{" "}
            {format(line.startDateTime, "EEE MMM d")}; the rest land on this person's next
            opening — drag them anywhere afterwards.
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {parts.map((p, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}
            >
              <span style={{ width: 108, fontSize: 13 }}>
                Part {i + 1}
                {i === 0 && (
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}> (this card)</span>
                )}
              </span>
              <input
                className="form-field__input"
                type="number"
                min="0.25"
                step="0.25"
                value={p}
                onChange={(e) => setPart(i, e.target.value)}
                style={{ width: 90 }}
                aria-label={`Part ${i + 1} hours`}
              />
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>h</span>
              {parts.length > 2 && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: "2px 8px", fontSize: 12 }}
                  onClick={() => removePart(i)}
                  aria-label={`Remove part ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 6, fontSize: 12 }}
            onClick={addPart}
          >
            + Add part
          </button>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--grid-line)",
            marginTop: 10,
            paddingTop: 8,
            fontSize: 12.5,
          }}
        >
          <Row label="This card holds" value={fmtHours(cardHours)} />
          {pot.otherParts > 0 && (
            <Row label={`Other parts (${pot.count - 1})`} value={fmtHours(pot.otherParts)} />
          )}
          <Row label="Task estimate" value={fmtHours(pot.pot)} />
          <Row
            label="Parts total"
            value={fmtHours(partsTotal)}
            tone={leftInCard === 0 ? undefined : "warn"}
          />
          {leftInCard !== 0 && (
            <div style={{ color: "var(--lumineo-red)", marginTop: 4 }}>
              {leftInCard > 0
                ? `${fmtHours(leftInCard)} of this card is unassigned — the parts don't add up to it.`
                : `${fmtHours(-leftInCard)} more than this card currently holds.`}
            </div>
          )}
          {overBy > 0 && (
            <div style={{ color: "var(--lumineo-red)", marginTop: 4 }}>
              ⚠ {fmtHours(taskTotal)} of {fmtHours(pot.pot)} — {fmtHours(overBy)} over the estimate.
              You can still split; the overage just shows on the cards.
            </div>
          )}
        </div>

        <div className="modal-card__actions">
          <button className="btn-secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!valid} onClick={() => void commit()}>
            {busy ? "Splitting…" : `Split into ${parts.length}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: tone === "warn" ? "var(--lumineo-red)" : undefined, fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
