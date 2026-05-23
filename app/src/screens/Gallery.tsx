import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { statusTone } from "../ui/specStatus";
import { SwipeRow } from "../ui/SwipeRow";
import { SIGN_TYPES, getSignType } from "../domain/signTypes";
import type { SignSpec } from "../domain/SignSpec";

export function Gallery() {
  const navigate = useNavigate();
  const { recent, loadSpec, duplicateSpec, deleteSpec } = useSpec();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const filtered = recent.filter((s) => {
    if (typeFilter && s.signTypeCode !== typeFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [s.customerName, s.projectName, s.productCode]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  function edit(s: SignSpec) {
    loadSpec(s);
    navigate("/builder");
  }

  function duplicate(s: SignSpec) {
    duplicateSpec(s);
    navigate("/builder");
  }

  async function confirmDelete(id: string) {
    setConfirming(null);
    await deleteSpec(id);
  }

  return (
    <main className="lum-page">
      <div>
        <div className="lum-section-label">Gallery</div>
        <h2 style={{ margin: 0, fontSize: 22, color: "var(--lum-navy)" }}>All saved specs</h2>
      </div>

      <div className="lum-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="search"
          className="lum-input"
          placeholder="Search by customer, project, or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "2 1 220px", minWidth: 140 }}
        />
        <select
          className="lum-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ flex: "1 1 160px", minWidth: 120 }}
        >
          <option value="">All sign types</option>
          {SIGN_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="sbp-list sbp-list--swipe">
        <div className="sbp-list__head">
          <span className="sbp-list__title">{filtered.length} spec{filtered.length === 1 ? "" : "s"}</span>
          <span className="sbp-list__head-hint">Swipe ◂ to edit / delete</span>
        </div>
        {filtered.length === 0 ? (
          <div className="sbp-list__empty">No specs match that filter.</div>
        ) : (
          filtered.map((s) => {
            const t = getSignType(s.signTypeCode || "");
            const isConfirming = confirming === s.id;
            const rowBody = (
              <div className="sbp-list__row" style={{ cursor: "pointer" }}>
                <div className="sbp-gallery-row__main">
                  <span className="sbp-list__row-title">{s.projectName || s.productCode || "Untitled"}</span>
                  <span className="sbp-list__row-meta">
                    {s.customerName ? `${s.customerName} · ` : ""}{t?.name ?? "—"} · Qty {s.quantity}
                  </span>
                </div>
                <div className="sbp-list__row-right sbp-list__row-right--desktop">
                  <Pill tone="navy">{s.productCode || "—"}</Pill>
                  <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                  {isConfirming ? (
                    <>
                      <button
                        type="button"
                        className="lum-btn is-danger"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); s.id && confirmDelete(s.id); }}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        className="lum-btn is-ghost"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="lum-btn is-ghost"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); duplicate(s); }}
                        title="Duplicate as a new draft"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="lum-btn is-ghost"
                        style={{ padding: "5px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); s.id && setConfirming(s.id); }}
                        title="Delete spec"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
                <div className="sbp-list__row-right sbp-list__row-right--mobile">
                  <Pill tone="navy">{s.productCode || "—"}</Pill>
                  <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                </div>
              </div>
            );
            return (
              <SwipeRow
                key={s.id}
                onActivate={() => edit(s)}
                actions={[
                  { label: "Duplicate", tone: "neutral", onClick: () => duplicate(s) },
                  { label: "Delete",    tone: "danger",  onClick: () => s.id && deleteSpec(s.id) },
                ]}
              >
                {rowBody}
              </SwipeRow>
            );
          })
        )}
      </div>
    </main>
  );
}
