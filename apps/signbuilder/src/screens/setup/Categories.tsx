import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { checkSetup } from "../../setup/check-setup";
import {
  addCategory,
  categoryCodeError,
  deleteCategory,
  deleteCategoryBlocker,
  moveCategory,
  newTypeInCategory,
  prefixClashes,
  updateCategory,
} from "../../setup/category-ops";
import { signTypeCodeError } from "../../setup/sign-type-ops";
import { useSetupStore } from "../../store/setup-store";
import { CommitInput } from "./setup-ui";

/** Setup → Categories: what people pick first when they add a sign (Channel
 *  Letters, Monument…), in the order they're offered, with each one's Spec Code
 *  prefix; + a new sign type in a category, copied from any existing one. */
export default function Categories({ initialCode, onOpenType }: { initialCode?: string; onOpenType: (signTypeCode: string) => void }) {
  const setup = useSetupStore((s) => s.setup);
  const replace = useSetupStore((s) => s.replace);
  const categories = useMemo(() => [...(setup?.categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)), [setup]);
  const [code, setCode] = useState(initialCode ?? "");
  const [adding, setAdding] = useState<{ code: string; description: string; prefix: string; error: string } | null>(null);
  const [newType, setNewType] = useState<{ from: string; code: string; description: string; error: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!categories.some((c) => c.code === code)) setCode(categories[0]?.code ?? "");
  }, [categories, code]);
  useEffect(() => {
    setNewType(null);
    setConfirmDelete(false);
  }, [code]);

  if (!setup) return <div className="sbp-muted">Loading…</div>;
  const current = categories.find((c) => c.code === code);
  const typesIn = (c: string) => setup.signTypes.filter((t) => t.categoryCode === c && !t.isBlock).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const activeTypes = (c: string) => typesIn(c).filter((t) => t.active).length;

  const runAdd = () => {
    if (!adding) return;
    const err = categoryCodeError(setup, adding.code);
    if (err) return setAdding({ ...adding, error: err });
    replace(addCategory(setup, adding.code, adding.description, adding.prefix), `Add category ${adding.code.toUpperCase()}`);
    setCode(adding.code.trim().toUpperCase());
    setAdding(null);
  };

  const runNewType = () => {
    if (!newType || !current) return;
    const err = signTypeCodeError(setup, newType.code) || (newType.from ? "" : "Pick the sign type to copy.");
    if (err) return setNewType({ ...newType, error: err });
    replace(newTypeInCategory(setup, current.code, newType.from, newType.code, newType.description), `New sign type ${newType.code.toUpperCase()} in ${current.code}`);
    onOpenType(newType.code.trim().toUpperCase());
  };

  const issues = current ? checkSetup(setup, { categoryCode: current.code }).filter((i) => !i.signTypeCode) : [];
  const clashes = current ? prefixClashes(setup, current.code, current.codePrefix) : [];
  const blocker = current ? deleteCategoryBlocker(setup, current.code) : "";
  const checklistLines = current ? setup.checklist.filter((l) => l.categoryCode === current.code).length : 0;

  return (
    <div className="sbp-setup-split" style={{ gridTemplateColumns: "340px 1fr" }}>
      <div className="sbp-card" data-tour="categories">
        <div className="sbp-row" style={{ marginBottom: 6 }}>
          <div className="sbp-caption">{categories.length} categories, in the order they're offered</div>
          <div className="sbp-spacer" />
          <button type="button" className="btn-secondary" onClick={() => setAdding({ code: "", description: "", prefix: "", error: "" })}>
            + Add
          </button>
        </div>
        {adding && (
          <div className="sbp-banner">
            <div className="sbp-field">
              <label>Code (can't be changed later)</label>
              <input className="sbp-input" value={adding.code} maxLength={20} placeholder="e.g. AWNING" onChange={(e) => setAdding({ ...adding, code: e.target.value.toUpperCase(), error: "" })} />
            </div>
            <div className="sbp-field">
              <label>Name</label>
              <input className="sbp-input" value={adding.description} placeholder="e.g. Awnings" onChange={(e) => setAdding({ ...adding, description: e.target.value })} />
            </div>
            <div className="sbp-field">
              <label>Spec Code prefix</label>
              <input className="sbp-input" value={adding.prefix} maxLength={10} placeholder="e.g. AW" onChange={(e) => setAdding({ ...adding, prefix: e.target.value.toUpperCase() })} />
            </div>
            <div className="sbp-muted" style={{ fontSize: 12 }}>It starts inactive — add its first sign type, then switch it on.</div>
            {adding.error && <div className="sbp-banner sbp-banner--error">{adding.error}</div>}
            <div className="sbp-row">
              <button type="button" className="btn-secondary" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={runAdd}>
                Add
              </button>
            </div>
          </div>
        )}
        {categories.map((c, i) => (
          <div key={c.code} className={`sbp-list-item${c.code === code ? " sbp-list-item--on" : ""}`} onClick={() => setCode(c.code)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {c.description} {c.codePrefix && <span className="sbp-code">{c.codePrefix}</span>}
              </div>
              <div className="sbp-muted" style={{ fontSize: 11 }}>
                {c.code} · {activeTypes(c.code)} of {typesIn(c.code).length} sign types active
              </div>
            </div>
            {!c.active && <span className="sbp-pill">inactive</span>}
            <button type="button" className="sbp-icon-btn" disabled={i === 0} title="Move up" onClick={(e) => (e.stopPropagation(), replace(moveCategory(setup, c.code, -1), `Move category ${c.code} up`))}>
              ↑
            </button>
            <button
              type="button"
              className="sbp-icon-btn"
              disabled={i === categories.length - 1}
              title="Move down"
              onClick={(e) => (e.stopPropagation(), replace(moveCategory(setup, c.code, 1), `Move category ${c.code} down`))}
            >
              ↓
            </button>
          </div>
        ))}
      </div>

      {current ? (
        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 10 }}>
            <div>
              <div className="sbp-caption">Category</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{current.code}</div>
            </div>
            <div className="sbp-spacer" />
            <button type="button" className="btn-danger" disabled={!!blocker} title={blocker || "Delete the category"} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>

          <div className="sbp-grid-fields">
            <div className="sbp-field">
              <label>Name</label>
              <CommitInput value={current.description} onCommit={(v) => replace(updateCategory(setup, current.code, { description: v.trim() || current.code }), `Rename category ${current.code}`)} />
            </div>
            <div className="sbp-field">
              <label>Spec Code prefix</label>
              <CommitInput value={current.codePrefix} onCommit={(v) => replace(updateCategory(setup, current.code, { codePrefix: v.trim().toUpperCase() }), `Spec Code prefix of ${current.code}`)} />
            </div>
          </div>
          <p className="sbp-muted" style={{ fontSize: 12, margin: "4px 0 8px" }}>
            Every Spec Code in the category starts with the prefix (e.g. <span className="sbp-code">{current.codePrefix || "CL"}-FL-EXT-WH</span>). Changing it changes the
            code of signs already spec'd the next time they're opened, so Sign Library searches on the old code won't find them.
          </p>
          {clashes.length > 0 && (
            <div className="sbp-banner sbp-banner--warn">
              {clashes.map((c) => c.description).join(", ")} use{clashes.length === 1 ? "s" : ""} the same prefix — their Spec Codes can look alike.
            </div>
          )}
          <label className="sbp-check" style={{ margin: "8px 0 14px" }}>
            <input
              type="checkbox"
              checked={current.active}
              onChange={(e) => replace(updateCategory(setup, current.code, { active: e.target.checked }), `${e.target.checked ? "Activate" : "Deactivate"} category ${current.code}`)}
            />{" "}
            Active — offered when someone adds a sign (signs already spec'd keep their category)
          </label>
          {issues.map((i, n) => (
            <div key={n} className={`sbp-banner ${i.severity === "error" ? "sbp-banner--error" : "sbp-banner--warn"}`}>
              <div>{i.text}</div>
              <div className="sbp-muted" style={{ fontSize: 12 }}>→ {i.fix}</div>
            </div>
          ))}

          <div className="sbp-row" style={{ marginTop: 6 }}>
            <div className="sbp-caption">Sign types</div>
            <div className="sbp-spacer" />
            <button type="button" className="btn-secondary" onClick={() => setNewType({ from: typesIn(current.code)[0]?.code ?? "", code: "", description: "", error: "" })}>
              + New sign type…
            </button>
          </div>
          {newType && (
            <div className="sbp-banner">
              <div className="sbp-grid-fields">
                <div className="sbp-field">
                  <label>Copy questions, rules and descriptions from</label>
                  <select className="sbp-input" value={newType.from} onChange={(e) => setNewType({ ...newType, from: e.target.value, error: "" })}>
                    <option value="">Pick a sign type…</option>
                    {categories.map((c) => (
                      <optgroup key={c.code} label={c.description}>
                        {typesIn(c.code).map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.description} ({t.code})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="sbp-field">
                  <label>New code</label>
                  <input className="sbp-input" value={newType.code} maxLength={20} onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase(), error: "" })} />
                </div>
                <div className="sbp-field">
                  <label>Description</label>
                  <input className="sbp-input" value={newType.description} onChange={(e) => setNewType({ ...newType, description: e.target.value })} />
                </div>
              </div>
              <p className="sbp-muted" style={{ fontSize: 12, margin: "6px 0" }}>
                The new sign type starts <b>inactive</b> with no Selected When; it opens on the Sign Types tab so you can finish it.
              </p>
              {newType.error && <div className="sbp-banner sbp-banner--error">{newType.error}</div>}
              <div className="sbp-row">
                <button type="button" className="btn-secondary" onClick={() => setNewType(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={runNewType}>
                  Create
                </button>
              </div>
            </div>
          )}
          {typesIn(current.code).length === 0 && <div className="sbp-muted">No sign types yet.</div>}
          <table className="sbp-table">
            <tbody>
              {typesIn(current.code).map((t) => (
                <tr key={t.code}>
                  <td style={{ fontWeight: 700 }}>
                    {t.description} <span className="sbp-muted">({t.code})</span>
                  </td>
                  <td className="sbp-muted" style={{ fontSize: 12 }}>{t.selectedWhen || "—"}</td>
                  <td>{!t.active && <span className="sbp-pill">inactive</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn-secondary" onClick={() => onOpenType(t.code)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="sbp-card sbp-muted">No categories yet.</div>
      )}

      {confirmDelete && current && (
        <ConfirmDialog
          title={`Delete ${current.description}?`}
          message={`The category${checklistLines ? ` and its ${checklistLines} stage checklist line${checklistLines === 1 ? "" : "s"}` : ""} will be removed. Undo brings it back this session.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            replace(deleteCategory(setup, current.code), `Delete category ${current.code}`);
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}
