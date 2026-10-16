import { useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import { existingOn, pasteQuestions, withFollowUps } from "../../setup/copy-ops";
import { useSetupStore } from "../../store/setup-store";

/** Copy questions of one sign type — with their answers, the rules that show
 *  them and their defaults — to other sign types. */
export default function CopyQuestions({ fromType, codes, onClose, onDone }: { fromType: string; codes: string[]; onClose: () => void; onDone: (msg: string) => void }) {
  const setup = useSetupStore((s) => s.setup)!;
  const replace = useSetupStore((s) => s.replace);
  const [followUps, setFollowUps] = useState(true);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [replaceExisting, setReplaceExisting] = useState(false);

  const all = useMemo(() => withFollowUps(setup, fromType, codes), [setup, fromType, codes]);
  const list = followUps ? all : codes;
  const extra = all.length - codes.length;
  const prompt = (c: string) => setup.questions.find((q) => q.signTypeCode === fromType && q.code === c)?.prompt ?? c;
  const categories = [...setup.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const typesOf = (cat: string) =>
    setup.signTypes.filter((t) => t.categoryCode === cat && !t.isBlock && t.code !== fromType).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const clashes = existingOn(setup, list, [...targets]);
  const toggle = (code: string, on: boolean) => {
    const n = new Set(targets);
    if (on) n.add(code);
    else n.delete(code);
    setTargets(n);
  };

  const run = () => {
    const r = pasteQuestions(setup, fromType, list, [...targets], replaceExisting);
    replace(r.setup, `Copy ${list.length} question${list.length === 1 ? "" : "s"} from ${fromType} to ${targets.size} sign type${targets.size === 1 ? "" : "s"}`);
    let msg = `Copied ${r.pasted} question${r.pasted === 1 ? "" : "s"} to ${targets.size} sign type${targets.size === 1 ? "" : "s"}.`;
    if (r.kept) msg += ` ${r.kept} already there were kept as they were.`;
    if (r.missingParents.length) msg += ` Check these — they depend on a question the sign type doesn't have: ${r.missingParents.join(", ")}.`;
    onDone(msg);
  };

  return (
    <Modal
      title={`Copy questions from ${fromType}`}
      onClose={onClose}
      wide
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={targets.size === 0} onClick={run}>
            Copy to {targets.size} sign type{targets.size === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, marginTop: 0 }}>
        Each question comes with its answers (and how they print, BC items, Spec Code segments), the rules that show it or limit its answers, and its defaults. It
        keeps its section and sort order — move it on the Questions tab if needed.
      </p>
      <div className="sbp-banner" style={{ fontSize: 13 }}>
        <b>{list.length} question{list.length === 1 ? "" : "s"}:</b> {list.map(prompt).join(" · ")}
      </div>
      {extra > 0 && (
        <label className="sbp-check" style={{ margin: "6px 0" }}>
          <input type="checkbox" checked={followUps} onChange={(e) => setFollowUps(e.target.checked)} /> Include the {extra} follow-up question{extra === 1 ? "" : "s"} they bring
          up
        </label>
      )}

      <div className="sbp-row" style={{ margin: "10px 0 4px" }}>
        <div className="sbp-caption">Copy to</div>
        <div className="sbp-spacer" />
        <button type="button" className="btn-secondary" onClick={() => setTargets(new Set())} disabled={targets.size === 0}>
          Clear
        </button>
      </div>
      <div className="sbp-copy-targets">
        {categories.map((c) => {
          const types = typesOf(c.code);
          if (types.length === 0) return null;
          const allOn = types.every((t) => targets.has(t.code));
          return (
            <div key={c.code} className="sbp-copy-targets__cat">
              <label className="sbp-check" style={{ fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={(e) => {
                    const n = new Set(targets);
                    for (const t of types) e.target.checked ? n.add(t.code) : n.delete(t.code);
                    setTargets(n);
                  }}
                />{" "}
                {c.description}
              </label>
              {types.map((t) => (
                <label key={t.code} className="sbp-check" style={{ marginLeft: 20 }}>
                  <input type="checkbox" checked={targets.has(t.code)} onChange={(e) => toggle(t.code, e.target.checked)} /> {t.description}{" "}
                  <span className="sbp-muted">({t.code})</span>
                  {!t.active && <span className="sbp-pill">inactive</span>}
                </label>
              ))}
            </div>
          );
        })}
      </div>

      {clashes.length > 0 && (
        <div className="sbp-banner sbp-banner--warn" style={{ marginTop: 10 }}>
          <div>
            Already there:{" "}
            {clashes.map((c) => (
              <span key={c.type}>
                <b>{c.type}</b> ({c.codes.join(", ")}){" "}
              </span>
            ))}
          </div>
          <label className="sbp-check" style={{ marginTop: 4 }}>
            <input type="radio" checked={!replaceExisting} onChange={() => setReplaceExisting(false)} /> Keep theirs — copy only the new questions
          </label>
          <label className="sbp-check">
            <input type="radio" checked={replaceExisting} onChange={() => setReplaceExisting(true)} /> Replace them with these (their answers, rules and defaults too)
          </label>
        </div>
      )}
    </Modal>
  );
}
