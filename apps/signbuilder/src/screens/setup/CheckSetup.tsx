import { useMemo, useState } from "react";
import { checkSetup, type SetupIssue } from "../../setup/check-setup";
import { useSetupStore } from "../../store/setup-store";

/** Setup → Check Setup: every problem in the setup, worst first, grouped by
 *  category and sign type. Runs on the current setup each time it's opened or
 *  changed. */
export default function CheckSetup({
  onOpenType,
  onOpenCategory,
}: {
  onOpenType: (signTypeCode: string, area?: SetupIssue["area"]) => void;
  onOpenCategory: (categoryCode: string) => void;
}) {
  const setup = useSetupStore((s) => s.setup);
  const [categoryCode, setCategoryCode] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);

  const all = useMemo(() => (setup ? checkSetup(setup) : []), [setup]);
  const shown = all.filter((i) => (!categoryCode || i.categoryCode === categoryCode) && (!errorsOnly || i.severity === "error"));
  const errors = all.filter((i) => i.severity === "error").length;
  const warnings = all.length - errors;

  if (!setup) return <div className="sbp-muted">Loading…</div>;

  const categoryName = (code: string) => setup.categories.find((c) => c.code === code)?.description ?? code;
  const typeName = (code: string) => setup.signTypes.find((t) => t.code === code)?.description ?? code;

  // Group: category → sign type (blank = the category itself).
  const groups = new Map<string, SetupIssue[]>();
  for (const i of [...shown].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1))) {
    const k = `${i.categoryCode}\u0001${i.signTypeCode}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    const [ca, ta] = a.split("\u0001");
    const [cb, tb] = b.split("\u0001");
    const sa = setup.categories.find((c) => c.code === ca)?.sortOrder ?? 999;
    const sb = setup.categories.find((c) => c.code === cb)?.sortOrder ?? 999;
    return sa - sb || ta!.localeCompare(tb!);
  });

  return (
    <div className="sbp-card" data-tour="check-setup">
      <div className="sbp-row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
        <div className={`sbp-pill ${errors ? "sbp-pill--warn" : "sbp-pill--approved"}`} style={{ fontSize: 12 }}>
          {errors} problem{errors === 1 ? "" : "s"}
        </div>
        <div className="sbp-pill" style={{ fontSize: 12 }}>
          {warnings} warning{warnings === 1 ? "" : "s"}
        </div>
        <div className="sbp-spacer" />
        <select className="sbp-input" style={{ width: 240 }} value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)}>
          <option value="">All categories</option>
          {[...setup.categories]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <option key={c.code} value={c.code}>
                {c.description}
              </option>
            ))}
        </select>
        <label className="sbp-check">
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} /> Problems only
        </label>
      </div>
      <p className="sbp-muted" style={{ fontSize: 12, marginTop: 0 }}>
        <b>Problems</b> stop something from working — a sign type nobody can pick, a question that's never asked. <b>Warnings</b> are worth a look (a Field
        Description line that gets skipped, a default that isn't one of the answers).
      </p>

      {shown.length === 0 && <div className="sbp-banner sbp-banner--ok">No problems found.</div>}
      {ordered.map(([k, list]) => {
        const [cat, type] = k.split("\u0001");
        return (
          <div key={k} className="sbp-check-group">
            <div className="sbp-row" style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 800 }}>
                {categoryName(cat!)}
                {type && (
                  <>
                    {" "}
                    › {typeName(type)} <span className="sbp-muted">({type})</span>
                  </>
                )}
              </div>
              <div className="sbp-spacer" />
              {!type && (
                <button type="button" className="btn-secondary" onClick={() => onOpenCategory(cat!)}>
                  Open category
                </button>
              )}
              {type && list.some((i) => i.area === "descriptions") && (
                <button type="button" className="btn-secondary" onClick={() => onOpenType(type, "descriptions")}>
                  Open its descriptions
                </button>
              )}
              {type && list.some((i) => !i.area) && (
                <button type="button" className="btn-secondary" onClick={() => onOpenType(type)}>
                  Open sign type
                </button>
              )}
            </div>
            {list.map((i, n) => (
              <div key={n} className={`sbp-banner ${i.severity === "error" ? "sbp-banner--error" : "sbp-banner--warn"}`} style={{ marginBottom: 6 }}>
                <div>
                  <b>{i.severity === "error" ? "Problem" : "Warning"}:</b> {i.text}
                </div>
                <div className="sbp-muted" style={{ fontSize: 12 }}>→ {i.fix}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
