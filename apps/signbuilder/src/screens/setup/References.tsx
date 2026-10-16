import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { SpecReference } from "../../domain/types";
import { prepareReferenceImages } from "../../setup/image-prep";
import {
  addReferenceRule,
  deleteReferenceRule,
  moveReferenceRule,
  referenceCodeError,
  rulesOf,
  typesUsingReference,
  updateReferenceRule,
} from "../../setup/reference-ops";
import { useSetupStore } from "../../store/setup-store";
import { ReferenceViewer } from "../builder/ReferencePanel";
import { ConditionEditor, describeWhen } from "./Descriptions";
import { CommitInput, TypePicker } from "./setup-ui";

type Mode = "pages" | "rules";

/** Setup → Spec References: the Sign Specification Reference pages (details
 *  and image), and which page each sign type shows (first matching rule wins). */
export default function References({
  typeCode,
  setTypeCode,
  mode,
  setMode,
}: {
  typeCode: string;
  setTypeCode: (c: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  return (
    <>
      <div className="sbp-tabs">
        <button type="button" className={`sbp-tab${mode === "pages" ? " sbp-tab--on" : ""}`} onClick={() => setMode("pages")}>
          Reference pages
        </button>
        <button type="button" className={`sbp-tab${mode === "rules" ? " sbp-tab--on" : ""}`} onClick={() => setMode("rules")}>
          Which page each sign type shows
        </button>
      </div>
      {mode === "pages" ? <Pages /> : <Rules typeCode={typeCode} setTypeCode={setTypeCode} />}
    </>
  );
}

function Pages() {
  const setup = useSetupStore((s) => s.setup);
  const saveReference = useSetupStore((s) => s.saveReference);
  const deleteReference = useSetupStore((s) => s.deleteReference);
  const loadImages = useSetupStore((s) => s.referenceImages);
  const refs = useMemo(() => [...(setup?.references ?? [])].sort((a, b) => a.description.localeCompare(b.description)), [setup]);
  const [code, setCode] = useState("");
  const [images, setImages] = useState<Pick<SpecReference, "thumbnail" | "fullImage">>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<{ code: string; description: string; error: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    if (!refs.some((r) => r.code === code)) setCode(refs[0]?.code ?? "");
  }, [refs, code]);
  useEffect(() => {
    let alive = true;
    setImages({});
    setError("");
    if (code) void loadImages(code).then((i) => alive && setImages(i));
    return () => {
      alive = false;
    };
  }, [code, loadImages]);

  if (!setup) return <div className="sbp-muted">Loading…</div>;
  const current = refs.find((r) => r.code === code);
  const usedBy = current ? typesUsingReference(setup, current.code) : [];

  const save = async (ref: SpecReference, what: string) => {
    setBusy(`${what}…`);
    setError("");
    try {
      await saveReference(ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const onImage = async (file: File | undefined) => {
    if (!file || !current) return;
    setBusy("Preparing the image…");
    setError("");
    try {
      const imgs = await prepareReferenceImages(file);
      setImages(imgs);
      await save({ ...current, ...imgs, fileName: current.fileName || file.name.replace(/\.[^.]+$/, "") }, "Saving the image");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  };

  const runAdd = async () => {
    if (!adding) return;
    const err = referenceCodeError(setup, adding.code);
    if (err) return setAdding({ ...adding, error: err });
    const c = adding.code.trim().toUpperCase();
    await save({ code: c, description: adding.description.trim() || c, fileName: "", sharePointUrl: "" }, "Adding");
    setCode(c);
    setAdding(null);
  };

  const thumb = images.thumbnail || images.fullImage;
  return (
    <div className="sbp-setup-split" style={{ gridTemplateColumns: "340px 1fr" }}>
      <div className="sbp-card" data-tour="references">
        <div className="sbp-row" style={{ marginBottom: 6 }}>
          <div className="sbp-caption">{refs.length} reference pages</div>
          <div className="sbp-spacer" />
          <button type="button" className="btn-secondary" onClick={() => setAdding({ code: "", description: "", error: "" })}>
            + Add
          </button>
        </div>
        {adding && (
          <div className="sbp-banner">
            <div className="sbp-field">
              <label>Code</label>
              <input className="sbp-input" value={adding.code} maxLength={20} placeholder="e.g. ST-31" onChange={(e) => setAdding({ ...adding, code: e.target.value.toUpperCase(), error: "" })} />
            </div>
            <div className="sbp-field">
              <label>Name</label>
              <input className="sbp-input" value={adding.description} placeholder="e.g. Awning frames" onChange={(e) => setAdding({ ...adding, description: e.target.value })} />
            </div>
            {adding.error && <div className="sbp-banner sbp-banner--error">{adding.error}</div>}
            <div className="sbp-row">
              <button type="button" className="btn-secondary" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={() => void runAdd()}>
                Add
              </button>
            </div>
          </div>
        )}
        <div className="sbp-tree">
          {refs.map((r) => (
            <div key={r.code} className={`sbp-list-item${r.code === code ? " sbp-list-item--on" : ""}`} onClick={() => setCode(r.code)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.description}</div>
                <div className="sbp-muted" style={{ fontSize: 11 }}>
                  {r.code} · {typesUsingReference(setup, r.code).length} sign types
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {current ? (
        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 10 }}>
            <div>
              <div className="sbp-caption">Reference page</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{current.code}</div>
            </div>
            <div className="sbp-spacer" />
            {busy && <span className="sbp-muted">{busy}</span>}
            <button
              type="button"
              className="btn-danger"
              disabled={usedBy.length > 0 || !!busy}
              title={usedBy.length ? "Sign types still show it — remove it from their rules first" : "Delete the page"}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          </div>
          {error && <div className="sbp-banner sbp-banner--error">{error}</div>}
          <div className="sbp-grid-fields">
            <div className="sbp-field">
              <label>Name</label>
              <CommitInput value={current.description} onCommit={(v) => void save({ ...current, description: v.trim() || current.code }, "Saving")} />
            </div>
            <div className="sbp-field">
              <label>File name (for downloads)</label>
              <CommitInput value={current.fileName} onCommit={(v) => void save({ ...current, fileName: v.trim() }, "Saving")} />
            </div>
          </div>
          <div className="sbp-field" style={{ marginTop: 6 }}>
            <label>SharePoint link (blank = the Spec Reference folder)</label>
            <CommitInput value={current.sharePointUrl} placeholder={setup.settings.specReferenceFolderUrl} onCommit={(v) => void save({ ...current, sharePointUrl: v.trim() }, "Saving")} />
          </div>
          <div className="sbp-muted" style={{ fontSize: 12, margin: "6px 0 10px" }}>
            Shown by: {usedBy.length ? usedBy.map((t) => setup.signTypes.find((x) => x.code === t)?.description ?? t).join(", ") : "no sign type yet"} · Changes here save
            straight away (Undo doesn't cover reference pages).
          </div>
          <div className="sbp-row" style={{ alignItems: "flex-start", gap: 14 }}>
            {thumb ? (
              <img className="sbp-ref__thumb" style={{ maxWidth: 360 }} src={thumb} alt={current.description} title="Click to view full size" onClick={() => setViewing(true)} />
            ) : (
              <div className="sbp-muted">No image yet.</div>
            )}
            <div>
              <label className="btn-secondary" style={{ display: "inline-block", cursor: busy ? "default" : "pointer" }}>
                {thumb ? "Replace image…" : "Add image…"}
                <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => void onImage(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
              </label>
              <div className="sbp-muted" style={{ fontSize: 11, marginTop: 6, maxWidth: 260 }}>
                PNG or JPG. Big images are shrunk to fit; a small preview is made automatically.
              </div>
            </div>
          </div>
          {viewing && <ReferenceViewer title={current.description} fileName={current.fileName || current.code} image={images.fullImage || thumb || ""} onClose={() => setViewing(false)} />}
        </div>
      ) : (
        <div className="sbp-card sbp-muted">No reference pages yet.</div>
      )}

      {confirmDelete && current && (
        <ConfirmDialog
          title={`Delete ${current.description}?`}
          message="The page and its image are removed for good (Undo doesn't bring reference pages back)."
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            setBusy("Deleting…");
            void deleteReference(current.code)
              .catch((e) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(""));
          }}
        />
      )}
    </div>
  );
}

function Rules({ typeCode, setTypeCode }: { typeCode: string; setTypeCode: (c: string) => void }) {
  const setup = useSetupStore((s) => s.setup);
  const idx = useSetupStore((s) => s.idx);
  const replace = useSetupStore((s) => s.replace);
  const [addCode, setAddCode] = useState("");
  if (!setup || !idx) return <div className="sbp-muted">Loading…</div>;
  const rules = rulesOf(setup, typeCode);
  const refs = [...setup.references].sort((a, b) => a.description.localeCompare(b.description));
  const refName = (c: string) => setup.references.find((r) => r.code === c)?.description ?? `${c} (missing page)`;

  return (
    <div className="sbp-card" data-tour="reference-rules">
      <TypePicker setup={setup} typeCode={typeCode} onChange={setTypeCode} />
      <p className="sbp-muted" style={{ fontSize: 12 }}>
        The sign shows the page of the <b>first</b> rule whose conditions its answers meet (once the sign type is decided). Put the specific rules above the general ones.
        Try it on the Test &amp; Path tab.
      </p>
      {rules.length === 0 && <div className="sbp-muted">No reference page set up for this sign type.</div>}
      {rules.map((r, i) => (
        <div key={r.lineNo} className="sbp-tpl" style={{ marginBottom: 6 }}>
          <div className="sbp-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="sbp-step__num">{i + 1}</span>
            <select
              className="sbp-input"
              style={{ width: 300 }}
              value={r.referenceCode}
              onChange={(e) => replace(updateReferenceRule(setup, typeCode, r.lineNo, { referenceCode: e.target.value }), `Reference rule of ${typeCode}`)}
            >
              {!setup.references.some((x) => x.code === r.referenceCode) && <option value={r.referenceCode}>{r.referenceCode} (missing page)</option>}
              {refs.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.description} ({x.code})
                </option>
              ))}
            </select>
            <span className="sbp-muted" style={{ fontSize: 12 }}>{describeWhen(idx, r)}</span>
            <div className="sbp-spacer" />
            <button type="button" className="sbp-icon-btn" disabled={i === 0} onClick={() => replace(moveReferenceRule(setup, typeCode, r.lineNo, -1), `Move reference rule of ${typeCode}`)}>
              ↑
            </button>
            <button type="button" className="sbp-icon-btn" disabled={i === rules.length - 1} onClick={() => replace(moveReferenceRule(setup, typeCode, r.lineNo, 1), `Move reference rule of ${typeCode}`)}>
              ↓
            </button>
            <button type="button" className="btn-secondary" onClick={() => replace(deleteReferenceRule(setup, typeCode, r.lineNo), `Delete reference rule (${refName(r.referenceCode)}) of ${typeCode}`)}>
              Delete
            </button>
          </div>
          <ConditionEditor
            label="Show it when"
            emptyLabel="— always (if no rule above matched) —"
            idx={idx}
            type={typeCode}
            question={r.conditionQuestion}
            values={r.conditionValues}
            onChange={(q, v) => replace(updateReferenceRule(setup, typeCode, r.lineNo, { conditionQuestion: q, conditionValues: v }), `Reference rule condition of ${typeCode}`)}
          />
          {(r.conditionQuestion || r.andConditionQuestion) && (
            <ConditionEditor
              label="…and when"
              idx={idx}
              type={typeCode}
              question={r.andConditionQuestion}
              values={r.andConditionValues}
              onChange={(q, v) => replace(updateReferenceRule(setup, typeCode, r.lineNo, { andConditionQuestion: q, andConditionValues: v }), `Reference rule condition of ${typeCode}`)}
            />
          )}
        </div>
      ))}
      <div className="sbp-row" style={{ marginTop: 10, gap: 8 }}>
        <select className="sbp-input" style={{ width: 300 }} value={addCode} onChange={(e) => setAddCode(e.target.value)}>
          <option value="">Pick a page…</option>
          {refs.map((x) => (
            <option key={x.code} value={x.code}>
              {x.description} ({x.code})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          disabled={!addCode}
          onClick={() => {
            replace(addReferenceRule(setup, typeCode, addCode), `Add reference rule (${refName(addCode)}) to ${typeCode}`);
            setAddCode("");
          }}
        >
          + Add rule
        </button>
      </div>
    </div>
  );
}
