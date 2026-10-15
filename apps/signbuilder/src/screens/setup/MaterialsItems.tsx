import { useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import type { BcItem } from "../../domain/types";
import { vinylLabel } from "../../engine/values";
import { addItemAnswer, cleanWording, questionsForFamily, setItemForValue, setShowPartNumbers } from "../../setup/item-ops";
import { describeItems, describeMaterial, matchConfidence, suggestItems, type MatchConfidence } from "../../setup/item-match";
import { useSetupStore } from "../../store/setup-store";

type Filter = "todo" | "pick" | "none" | "linked" | "all";

const STATUS: Record<MatchConfidence | "linked" | "mixed", { label: string; cls: string }> = {
  linked: { label: "Linked", cls: "sbp-pill--approved" },
  mixed: { label: "Mixed", cls: "sbp-pill--warn" },
  high: { label: "Suggested", cls: "sbp-pill--submitted" },
  medium: { label: "Suggested", cls: "sbp-pill--submitted" },
  pick: { label: "Pick one", cls: "sbp-pill--warn" },
  none: { label: "No BC item", cls: "" },
};

/** Setup → Materials & Items: link each material answer to its BC item (Item
 *  No.), turn part numbers in the descriptions on/off, and add BC items that
 *  no answer offers yet as new answers. */
export default function MaterialsItems() {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<{ item: BcItem; wording: string; picked: Set<string> } | null>(null);

  const items = useMemo(() => setup?.items ?? [], [setup]);
  const described = useMemo(() => describeItems(items), [items]);
  const itemByNo = useMemo(() => new Map(items.map((i) => [i.no, i])), [items]);

  // One row per distinct material wording (the same words = the same part).
  const rows = useMemo(() => {
    if (!setup) return [];
    const map = new Map<string, { value: string; uses: number; types: Set<string>; itemNos: Set<string> }>();
    for (const o of setup.options) {
      if (!describeMaterial(o.value).family) continue;
      const r = map.get(o.value) ?? { value: o.value, uses: 0, types: new Set<string>(), itemNos: new Set<string>() };
      r.uses++;
      r.types.add(o.signTypeCode);
      r.itemNos.add(o.itemNo ?? "");
      map.set(o.value, r);
    }
    return [...map.values()]
      .map((r) => {
        const s = suggestItems(r.value, items, described);
        const linked = [...r.itemNos].filter(Boolean);
        const status: MatchConfidence | "linked" | "mixed" = r.itemNos.size > 1 ? "mixed" : linked.length === 1 ? "linked" : matchConfidence(s);
        return { ...r, suggestions: s, linkedNo: linked.length === 1 && r.itemNos.size === 1 ? linked[0]! : "", status };
      })
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [setup, items, described]);

  if (!setup) return <div className="sbp-muted">Loading…</div>;

  const shown = rows.filter((r) => {
    if (search && !`${r.value} ${r.linkedNo} ${itemByNo.get(r.linkedNo)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "todo") return r.status !== "linked" && r.status !== "none";
    if (filter === "pick") return r.status === "pick" || r.status === "mixed";
    if (filter === "none") return r.status === "none";
    if (filter === "linked") return r.status === "linked";
    return true;
  });
  const count = (f: Filter) => rows.filter((r) => (f === "todo" ? r.status !== "linked" && r.status !== "none" : f === "pick" ? r.status === "pick" || r.status === "mixed" : f === "none" ? r.status === "none" : f === "linked" ? r.status === "linked" : true)).length;

  const link = (value: string, itemNo: string) => replace(setItemForValue(setup, value, itemNo), itemNo ? `Link "${value}" to #${itemNo}` : `Unlink "${value}"`);
  const acceptAll = () => {
    let next = setup;
    for (const r of rows) {
      if ((r.status === "high" || r.status === "medium") && r.suggestions[0]) next = setItemForValue(next, r.value, r.suggestions[0].item.no);
    }
    replace(next, "Link the suggested items");
  };

  // BC items no answer offers yet (only kinds of material the answers use).
  const usedNos = new Set(setup.options.map((o) => o.itemNo).filter(Boolean));
  const usedFamilies = new Set(rows.map((r) => describeMaterial(r.value).family));
  const unused = items.filter((i) => !usedNos.has(i.no) && usedFamilies.has(described.get(i.no)?.family ?? "") && described.get(i.no)?.family !== "vinyl");
  const unusedByCat = new Map<string, BcItem[]>();
  for (const i of unused) unusedByCat.set(i.category, [...(unusedByCat.get(i.category) ?? []), i]);

  const vinylLinked = setup.vinylColors.filter((c) => c.itemNo).length;
  const suggestedCount = rows.filter((r) => r.status === "high" || r.status === "medium").length;

  return (
    <div className="sbp-card" data-tour="materials-items">
      <div className="sbp-row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
        <label className="sbp-check" style={{ fontWeight: 700 }}>
          <input type="checkbox" checked={!!setup.settings.showPartNumbers} onChange={(e) => replace(setShowPartNumbers(setup, e.target.checked), "Show part numbers")} />
          Show part numbers in the descriptions — e.g. 2”x2”x.187” Aluminum Angle (#20050)
        </label>
        <div className="sbp-spacer" />
        <span className="sbp-muted" style={{ fontSize: 12 }}>
          {items.length} BC items · {vinylLinked} of {setup.vinylColors.length} vinyl colors linked
        </span>
      </div>
      {items.length === 0 && (
        <div className="sbp-banner sbp-banner--warn">No BC items in the setup yet — they come with the setup file (scripts/fix-bc-setup-export.mjs with the item list).</div>
      )}

      <div className="sbp-row" style={{ flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
        {(
          [
            ["todo", "To do"],
            ["pick", "Pick one"],
            ["none", "No BC item"],
            ["linked", "Linked"],
            ["all", "All"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" className={`sbp-choice${filter === f ? " sbp-choice--on" : ""}`} onClick={() => setFilter(f)}>
            {label} ({count(f)})
          </button>
        ))}
        <div className="sbp-spacer" />
        <input className="sbp-input" style={{ width: 220 }} placeholder="Search answers or items…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {suggestedCount > 0 && (
          <button type="button" className="btn-primary" onClick={acceptAll}>
            Accept {suggestedCount} suggestion{suggestedCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <table className="sbp-table">
        <thead>
          <tr>
            <th>Answer (as printed)</th>
            <th>Used</th>
            <th>Status</th>
            <th>BC item</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const fam = describeMaterial(r.value).family;
            const others = items.filter((i) => described.get(i.no)?.family === fam && !r.suggestions.some((s) => s.item.no === i.no));
            const current = r.linkedNo || (r.status === "high" || r.status === "medium" ? "" : "");
            return (
              <tr key={r.value}>
                <td style={{ fontWeight: 600 }}>{r.value}</td>
                <td className="sbp-muted" title={[...r.types].join(", ")}>
                  {r.uses}× · {r.types.size} type{r.types.size === 1 ? "" : "s"}
                </td>
                <td>
                  <span className={`sbp-pill ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                </td>
                <td>
                  <div className="sbp-row" style={{ gap: 6 }}>
                    <select className="sbp-input" style={{ minWidth: 320 }} value={current} onChange={(e) => link(r.value, e.target.value)}>
                      <option value="">{r.status === "mixed" ? "— different items on different types —" : "— not linked —"}</option>
                      {r.suggestions.length > 0 && (
                        <optgroup label="Best matches">
                          {r.suggestions.slice(0, 8).map((s) => (
                            <option key={s.item.no} value={s.item.no}>
                              #{s.item.no} {s.item.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {others.length > 0 && (
                        <optgroup label="Other items of this kind">
                          {others.map((i) => (
                            <option key={i.no} value={i.no}>
                              #{i.no} {i.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {!r.linkedNo && (r.status === "high" || r.status === "medium") && r.suggestions[0] && (
                      <button type="button" className="btn-secondary" onClick={() => link(r.value, r.suggestions[0]!.item.no)} title={r.suggestions[0].item.name}>
                        Use #{r.suggestions[0].item.no}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <td colSpan={4} className="sbp-muted">
                Nothing here.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="sbp-caption" style={{ marginTop: 22 }}>
        BC items no answer offers yet ({unused.length})
      </div>
      <p className="sbp-muted" style={{ fontSize: 12, marginTop: 2 }}>
        Kinds of material the answers already use. <b>Add as answer</b> words it the way the answers are written (edit it before adding) and adds it, linked, to the
        questions you tick.
      </p>
      {[...unusedByCat.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, list]) => (
          <details key={cat} className="sbp-item-cat">
            <summary>
              {cat} <span className="sbp-muted">({list.length})</span>
            </summary>
            {list.map((i) => (
              <div key={i.no} className="sbp-list-item" style={{ cursor: "default" }}>
                <div style={{ flex: 1 }}>
                  #{i.no} {i.name} <span className="sbp-muted">· {i.uom}</span>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const targets = questionsForFamily(setup, described.get(i.no)?.family ?? "");
                    setAdding({ item: i, wording: cleanWording(i), picked: new Set(targets.map((t) => `${t.signTypeCode}\u0001${t.questionCode}`)) });
                  }}
                >
                  Add as answer…
                </button>
              </div>
            ))}
          </details>
        ))}

      <div className="sbp-caption" style={{ marginTop: 22 }}>
        Vinyl colors without a BC item ({setup.vinylColors.length - vinylLinked})
      </div>
      <p className="sbp-muted" style={{ fontSize: 12, marginTop: 2 }}>
        Linked to the 48” roll. These colors have no item in BC (not stocked?):{" "}
        {setup.vinylColors
          .filter((c) => !c.itemNo)
          .map((c) => vinylLabel(c))
          .join(" · ") || "none"}
      </p>

      {adding && <AddAnswerDialog adding={adding} setAdding={setAdding} onCancel={() => setAdding(null)} />}
    </div>
  );
}

function AddAnswerDialog({
  adding,
  setAdding,
  onCancel,
}: {
  adding: { item: BcItem; wording: string; picked: Set<string> };
  setAdding: (a: { item: BcItem; wording: string; picked: Set<string> } | null) => void;
  onCancel: () => void;
}) {
  const setup = useSetupStore((s) => s.setup)!;
  const replace = useSetupStore((s) => s.replace);
  const fam = describeMaterial(adding.item.name, adding.item.category).family;
  const targets = questionsForFamily(setup, fam);
  const toggle = (k: string) => {
    const next = new Set(adding.picked);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setAdding({ ...adding, picked: next });
  };
  const add = () => {
    const chosen = targets.filter((t) => adding.picked.has(`${t.signTypeCode}\u0001${t.questionCode}`));
    replace(addItemAnswer(setup, chosen, adding.wording.trim(), adding.item.no), `Add "${adding.wording.trim()}" (#${adding.item.no}) to ${chosen.length} questions`);
    onCancel();
  };
  return (
    <Modal
      title={`Add #${adding.item.no} as an answer`}
      onClose={onCancel}
      actions={
        <button type="button" className="btn-primary" disabled={!adding.wording.trim() || adding.picked.size === 0} onClick={add}>
          Add to {adding.picked.size} question{adding.picked.size === 1 ? "" : "s"}
        </button>
      }
    >
        <div className="sbp-muted" style={{ fontSize: 12, marginBottom: 8 }}>
          BC: {adding.item.name}
        </div>
        <div className="sbp-field">
          <label>Answer wording</label>
          <input className="sbp-input" value={adding.wording} onChange={(e) => setAdding({ ...adding, wording: e.target.value })} />
        </div>
        <div className="sbp-row" style={{ marginTop: 10 }}>
          <div className="sbp-caption">
            Add to these questions ({adding.picked.size} of {targets.length})
          </div>
          <div className="sbp-spacer" />
          <button type="button" className="btn-secondary" onClick={() => setAdding({ ...adding, picked: new Set(targets.map((t) => `${t.signTypeCode}\u0001${t.questionCode}`)) })}>
            All
          </button>
          <button type="button" className="btn-secondary" onClick={() => setAdding({ ...adding, picked: new Set() })}>
            None
          </button>
        </div>
        <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid var(--border-default)", borderRadius: 8, padding: 6 }}>
          {targets.map((t) => {
            const k = `${t.signTypeCode}\u0001${t.questionCode}`;
            return (
              <label key={k} className="sbp-check" style={{ display: "flex", padding: "3px 4px" }}>
                <input type="checkbox" checked={adding.picked.has(k)} onChange={() => toggle(k)} />
                {t.typeName} › {t.prompt} <span className="sbp-muted">({t.questionCode})</span>
              </label>
            );
          })}
          {targets.length === 0 && <div className="sbp-muted">No questions use this kind of material yet.</div>}
        </div>
    </Modal>
  );
}
