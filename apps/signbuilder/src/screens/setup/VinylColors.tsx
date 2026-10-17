import { useMemo, useState } from "react";
import { vinylLabel } from "../../engine/values";
import { addVinylColor, colorKey, deleteVinylColor, updateVinylColor, vinylCodeError } from "../../setup/reference-ops";
import { useSetupStore } from "../../store/setup-store";
import { CommitInput } from "./setup-ui";

/** Setup → Vinyl Colors: the colors offered on vinyl questions, by series
 *  (3630, 7725…), with their swatch, Pantone match and BC item (48" roll). */
export default function VinylColors() {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const series = useMemo(() => [...new Set((setup?.vinylColors ?? []).map((c) => c.series))].sort(), [setup]);
  const [pick, setPick] = useState("");
  const [find, setFind] = useState("");
  const [adding, setAdding] = useState<{ series: string; code: string; name: string; error: string } | null>(null);

  if (!setup) return <div className="sbp-muted">Loading…</div>;
  const s = pick || series[0] || "";
  const q = find.trim().toLowerCase();
  const colors = setup.vinylColors
    .filter((c) => c.series === s && (!q || `${c.code} ${c.name} ${c.family} ${c.pantoneRef} ${c.itemNo ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const itemName = (no?: string) => (no ? setup.items?.find((i) => i.no === no)?.name : undefined);
  const set = (key: string, patch: Parameters<typeof updateVinylColor>[2], what: string) => replace(updateVinylColor(setup, key, patch), `${what} vinyl ${key.split("|")[1]}`);

  const runAdd = () => {
    if (!adding) return;
    const err = vinylCodeError(setup, adding.series, adding.code);
    if (err) return setAdding({ ...adding, error: err });
    replace(addVinylColor(setup, adding), `Add vinyl ${adding.code}`);
    setPick(adding.series.trim());
    setAdding(null);
  };

  return (
    <div className="sbp-card" data-tour="vinyl-colors">
      <div className="sbp-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="sbp-tabs" style={{ margin: 0 }}>
          {series.map((x) => (
            <button key={x} type="button" className={`sbp-tab${x === s ? " sbp-tab--on" : ""}`} onClick={() => setPick(x)}>
              {x} ({setup.vinylColors.filter((c) => c.series === x).length})
            </button>
          ))}
        </div>
        <input className="sbp-input" style={{ width: 220 }} placeholder="Find a color…" value={find} onChange={(e) => setFind(e.target.value)} />
        <div className="sbp-spacer" />
        <button type="button" className="btn-secondary" onClick={() => setAdding({ series: s, code: `${s}-`, name: "", error: "" })}>
          + Add color
        </button>
      </div>
      <p className="sbp-muted" style={{ fontSize: 12 }}>
        Answers print as “code name”, e.g. <b>{colors[0] ? vinylLabel(colors[0]) : "3630-20 White"}</b>. Renaming a color changes how new answers print; signs already
        spec'd keep the old wording. The BC item is the 48" roll unless you set another.
      </p>
      {adding && (
        <div className="sbp-banner" style={{ marginBottom: 8 }}>
          <div className="sbp-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="sbp-field" style={{ width: 100 }}>
              <label>Series</label>
              <input className="sbp-input" value={adding.series} onChange={(e) => setAdding({ ...adding, series: e.target.value, error: "" })} />
            </div>
            <div className="sbp-field" style={{ width: 140 }}>
              <label>Code</label>
              <input className="sbp-input" value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value, error: "" })} />
            </div>
            <div className="sbp-field" style={{ width: 220 }}>
              <label>Name</label>
              <input className="sbp-input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
            </div>
            <button type="button" className="btn-secondary" onClick={() => setAdding(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={runAdd}>
              Add
            </button>
          </div>
          {adding.error && <div className="sbp-banner sbp-banner--error" style={{ marginTop: 6 }}>{adding.error}</div>}
        </div>
      )}
      <div className="sbp-matrix-wrap">
        <table className="sbp-table sbp-vinyl-table">
          <thead>
            <tr>
              <th />
              <th>Code</th>
              <th>Name</th>
              <th>Family</th>
              <th>Pantone</th>
              <th>Swatch</th>
              <th>BC item #</th>
              <th>Notes</th>
              <th>Order</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {colors.map((c) => {
              const key = colorKey(c);
              return (
                <tr key={key}>
                  <td>
                    <span className="sbp-vinyl-chip" style={{ background: c.hex || "transparent" }} />
                  </td>
                  <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{c.code}</td>
                  <td>
                    <CommitInput value={c.name} onCommit={(v) => set(key, { name: v.trim() }, "Rename")} />
                  </td>
                  <td>
                    <CommitInput value={c.family} onCommit={(v) => set(key, { family: v.trim() }, "Family of")} style={{ width: 110 }} />
                  </td>
                  <td>
                    <CommitInput value={c.pantoneRef} onCommit={(v) => set(key, { pantoneRef: v.trim() }, "Pantone of")} style={{ width: 150 }} />
                  </td>
                  <td>
                    <CommitInput value={c.hex} placeholder="#RRGGBB" onCommit={(v) => set(key, { hex: v.trim() }, "Swatch of")} style={{ width: 95 }} />
                  </td>
                  <td title={itemName(c.itemNo) ?? ""}>
                    <CommitInput value={c.itemNo ?? ""} onCommit={(v) => set(key, { itemNo: v.trim() || undefined }, "BC item of")} style={{ width: 80 }} />
                    {c.itemNo && !itemName(c.itemNo) && setup.items?.length ? <div className="sbp-muted" style={{ fontSize: 10 }}>not in the item list</div> : null}
                  </td>
                  <td>
                    <CommitInput value={c.notes} onCommit={(v) => set(key, { notes: v.trim() }, "Notes of")} style={{ width: 160 }} />
                  </td>
                  <td>
                    <CommitInput value={String(c.sortOrder)} onCommit={(v) => set(key, { sortOrder: Number(v) || 0 }, "Order of")} style={{ width: 60 }} />
                  </td>
                  <td>
                    <button type="button" className="sbp-icon-btn" title="Delete the color" onClick={() => replace(deleteVinylColor(setup, key), `Delete vinyl ${c.code}`)}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {colors.length === 0 && <div className="sbp-muted">No colors{q ? " match" : ""}.</div>}
    </div>
  );
}
