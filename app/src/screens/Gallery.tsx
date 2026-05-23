import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { statusTone } from "../ui/specStatus";
import { SIGN_TYPES, getSignType } from "../domain/signTypes";

export function Gallery() {
  const navigate = useNavigate();
  const { recent, loadSpec } = useSpec();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = recent.filter((s) => {
    if (typeFilter && s.signTypeCode !== typeFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [s.customerName, s.projectName, s.productCode]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  return (
    <main className="lum-page">
      <div>
        <div className="lum-section-label">Gallery</div>
        <h2 style={{ margin: 0, fontSize: 22, color: "var(--lum-navy)" }}>All saved specs</h2>
      </div>

      <div className="lum-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="search"
          className="lum-input"
          placeholder="Search by customer, project, or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 2 }}
        />
        <select
          className="lum-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">All sign types</option>
          {SIGN_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="sbp-list">
        <div className="sbp-list__head">
          <span className="sbp-list__title">{filtered.length} spec{filtered.length === 1 ? "" : "s"}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="sbp-list__empty">No specs match that filter.</div>
        ) : (
          filtered.map((s) => {
            const t = getSignType(s.signTypeCode || "");
            return (
              <button
                key={s.id}
                type="button"
                className="sbp-list__row"
                onClick={() => { loadSpec(s); navigate("/builder"); }}
              >
                <div className="sbp-list__row-main">
                  <span className="sbp-list__row-title">{s.projectName || s.productCode || "Untitled"}</span>
                  <span className="sbp-list__row-meta">
                    {s.customerName ? `${s.customerName} · ` : ""}{t?.name ?? "—"} · Qty {s.quantity}
                  </span>
                </div>
                <div className="sbp-list__row-right">
                  <Pill tone="navy">{s.productCode || "—"}</Pill>
                  <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                  <span className="sbp-list__chevron">›</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </main>
  );
}
