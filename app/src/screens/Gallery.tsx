// Gallery — saved-specs browser. Per docs/07-sub-apps.md the spec list filters
// by (customer, status, sign type). Re-skinned to the design-system panel +
// list-row pattern.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { statusTone } from "../ui/specStatus";
import { SwipeRow } from "../ui/SwipeRow";
import { SIGN_TYPES, getSignType } from "../domain/signTypes";
import type { SignSpec } from "../domain/SignSpec";

const STATUS_OPTIONS = ["", "Draft", "Submitted", "Approved", "Built"] as const;

export function Gallery() {
  const navigate = useNavigate();
  const { recent, loadSpec, duplicateSpec, deleteSpec } = useSpec();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const customers = useMemo(() => {
    const seen = new Set<string>();
    for (const s of recent) if (s.customerName) seen.add(s.customerName);
    return Array.from(seen).sort();
  }, [recent]);

  const filtered = recent.filter((s) => {
    if (typeFilter && s.signTypeCode !== typeFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (customerFilter && s.customerName !== customerFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [s.customerName, s.projectName, s.productCode, s.name]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  function edit(s: SignSpec) { loadSpec(s); navigate("/builder"); }
  function duplicate(s: SignSpec) { duplicateSpec(s); navigate("/builder"); }
  async function confirmDelete(id: string) { setConfirming(null); await deleteSpec(id); }

  return (
    <>
      <div className="lum-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="search"
          className="lum-input"
          placeholder="Search by customer, project, name, or code…"
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
        <select
          className="lum-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ flex: "1 1 140px", minWidth: 110 }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s || "all"} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <select
          className="lum-select"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          style={{ flex: "1 1 160px", minWidth: 120 }}
        >
          <option value="">All customers</option>
          {customers.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="lum-panel">
        <div className="lum-panel__head">
          <span>{filtered.length} spec{filtered.length === 1 ? "" : "s"}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="sbp-list-empty">No specs match that filter.</div>
        ) : (
          filtered.map((s) => {
            const t = getSignType(s.signTypeCode || "");
            const isConfirming = confirming === s.id;
            const rowBody = (
              <div className="sbp-list-row" style={{ cursor: "pointer" }}>
                <div className="sbp-list-row__main">
                  <span className="sbp-list-row__title">{s.name || s.projectName || s.productCode || "Untitled"}</span>
                  <span className="sbp-list-row__sub">
                    {s.customerName ? `${s.customerName} · ` : ""}{t?.name ?? "—"} · Qty {s.quantity}
                  </span>
                </div>
                <div className="sbp-list-row__right">
                  <Pill tone="navy">{s.productCode || "—"}</Pill>
                  <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                  {isConfirming ? (
                    <>
                      <button
                        type="button"
                        className="lum-btn is-danger"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); s.id && confirmDelete(s.id); }}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        className="lum-btn"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); setConfirming(null); }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="lum-btn"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); duplicate(s); }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="lum-btn"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); s.id && setConfirming(s.id); }}
                      >
                        Delete
                      </button>
                    </>
                  )}
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
    </>
  );
}
