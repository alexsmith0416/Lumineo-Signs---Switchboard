import { useMemo, useState } from "react";
import { Progress, StatusPill } from "../components/ui";
import { useSetupStore } from "../store/setup-store";
import { useSpecStore } from "../store/spec-store";

/** Every sign ever spec'd — filter by Spec Code to find signs built the same
 *  way (sales: "here's one we did like that"). */
export default function Library({ onOpenSpec }: { onOpenSpec: (id: string) => void }) {
  const lines = useSpecStore((s) => s.lines);
  const specs = useSpecStore((s) => s.specs);
  const idx = useSetupStore((s) => s.idx);
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const c = code.trim().toUpperCase();
    const q = search.trim().toLowerCase();
    return lines
      .map((l) => ({ line: l, spec: specs.find((s) => s.id === l.specId) }))
      .filter(({ line, spec }) => {
        if (category && line.categoryCode !== category) return false;
        if (c && !line.specCode.toUpperCase().startsWith(c)) return false;
        if (q && ![line.signName, spec?.customerName, spec?.number, spec?.jobNo, line.specCode].join(" ").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.spec?.modifiedAt ?? "").localeCompare(a.spec?.modifiedAt ?? ""));
  }, [lines, specs, code, category, search]);

  /** First parts of a code — "same type" matches. */
  const codeStart = (full: string, parts: number) => full.split("-").slice(0, parts).join("-");

  return (
    <div className="sbp-page">
      <div className="sbp-card" data-tour="library-filter">
        <div className="sbp-row">
          <div className="sbp-field">
            <label>Spec Code starts with</label>
            <input className="sbp-input" placeholder="e.g. WC-IL" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="sbp-field">
            <label>Category</label>
            <select className="sbp-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All</option>
              {idx?.activeCategories().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.description}
                </option>
              ))}
            </select>
          </div>
          <div className="sbp-field" style={{ flex: 1 }}>
            <label>Search</label>
            <input className="sbp-input" placeholder="Customer, sign name, spec or job no." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="sbp-card">
        <table className="sbp-table">
          <thead>
            <tr>
              <th>Spec Code</th>
              <th>Sign</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Customer</th>
              <th>Spec / Job</th>
              <th>Completed</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ line, spec }) => (
              <tr key={line.id} className="sbp-table__row--click" onClick={() => spec && onOpenSpec(spec.id)}>
                <td>
                  <span className="sbp-code">{line.specCode || "—"}</span>
                </td>
                <td>{line.signName}</td>
                <td>{line.typeDecided ? idx?.signType(line.signTypeCode)?.description : idx?.category(line.categoryCode)?.description}</td>
                <td>{line.quantity}</td>
                <td>{spec?.customerName}</td>
                <td>
                  {spec?.number}
                  {spec?.jobNo ? ` · ${spec.jobNo}` : ""}
                </td>
                <td>
                  <Progress pct={line.completedPct} />
                </td>
                <td>{spec && <StatusPill status={spec.status} />}</td>
                <td>
                  {line.specCode && (
                    <span className="sbp-row" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn-secondary" title="Signs with the same Spec Code" onClick={() => setCode(line.specCode)}>
                        Same code
                      </button>
                      <button type="button" className="btn-secondary" title="Signs of the same category and type" onClick={() => setCode(codeStart(line.specCode, 2))}>
                        Same type
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="sbp-muted" style={{ padding: 10 }}>No signs match.</div>}
      </div>
    </div>
  );
}
