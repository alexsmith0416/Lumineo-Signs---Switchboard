import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { SetupVersion } from "../../domain/types";
import { repo } from "../../services/repo";
import { diffSetups, isSameSetup, newVersionHeader, type SetupDiff } from "../../setup/version-ops";
import { useSetupStore } from "../../store/setup-store";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Setup → Versions: save a named copy of the whole setup, see what changed
 *  since one, and put one back. Unlike Undo they last after the app is closed.
 *  A version is saved automatically before an import and before a restore. */
export default function Versions({ userName }: { userName: string }) {
  const setup = useSetupStore((s) => s.setup);
  const restoreVersion = useSetupStore((s) => s.restoreVersion);
  const [versions, setVersions] = useState<SetupVersion[] | null>(null);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [compare, setCompare] = useState<{ id: string; diff?: SetupDiff; error?: string } | null>(null);
  const [restoring, setRestoring] = useState<SetupVersion | null>(null);
  const [deleting, setDeleting] = useState<SetupVersion | null>(null);

  const load = useCallback(async () => {
    try {
      setVersions(await repo().listVersions());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setVersions([]);
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (!setup) return <div className="sbp-muted">Loading…</div>;
  const progress = (what: string) => (d: number, t: number) => setBusy(`${what}… ${d} of ${t}`);
  const run = async (what: string, fn: () => Promise<void>, ok: string) => {
    setError("");
    setDone("");
    setBusy(`${what}…`);
    try {
      await fn();
      setDone(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const save = () =>
    run(
      "Saving",
      async () => {
        const header = newVersionHeader(setup, label || `Setup – ${when(new Date().toISOString())}`, note, "manual", userName);
        await repo().saveVersion(header, setup, progress("Saving"));
        setLabel("");
        setNote("");
      },
      "Version saved.",
    );

  const openCompare = async (v: SetupVersion) => {
    if (compare?.id === v.id) return setCompare(null);
    setCompare({ id: v.id });
    try {
      const then = await repo().loadVersion(v.id);
      setCompare({ id: v.id, diff: diffSetups(then, setup) });
    } catch (e) {
      setCompare({ id: v.id, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <div className="sbp-card" data-tour="versions">
        <div className="sbp-caption">Save a version</div>
        <p className="sbp-muted" style={{ fontSize: 12, marginTop: 2 }}>
          A copy of the whole setup — every category, sign type, question, answer, rule and description — you can compare with or put back later. Save one before a
          big change. One is also saved automatically before an import from Business Central and before a restore.
        </p>
        <div className="sbp-grid-fields" style={{ gridTemplateColumns: "1fr 2fr" }}>
          <div className="sbp-field">
            <label>Name</label>
            <input className="sbp-input" value={label} maxLength={100} placeholder={`Setup – ${when(new Date().toISOString())}`} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="sbp-field">
            <label>Note (optional)</label>
            <input className="sbp-input" value={note} placeholder="e.g. Before changing the monument frames" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="sbp-row" style={{ marginTop: 8 }}>
          {busy && <span className="sbp-muted">{busy}</span>}
          {done && !busy && <span className="sbp-pill sbp-pill--approved">{done}</span>}
          <div className="sbp-spacer" />
          <button type="button" className="btn-primary" disabled={!!busy} onClick={() => void save()}>
            Save version
          </button>
        </div>
        {error && <div className="sbp-banner sbp-banner--error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      <div className="sbp-card">
        <div className="sbp-caption">Saved versions</div>
        {versions === null && <div className="sbp-muted">Loading…</div>}
        {versions?.length === 0 && <div className="sbp-muted">No versions saved yet.</div>}
        {versions && versions.length > 0 && (
          <table className="sbp-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Saved</th>
                <th>What's in it</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <VersionRow
                  key={v.id}
                  v={v}
                  busy={!!busy}
                  compare={compare?.id === v.id ? compare : null}
                  onCompare={() => void openCompare(v)}
                  onRestore={() => setRestoring(v)}
                  onDelete={() => setDeleting(v)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {restoring && (
        <ConfirmDialog
          title={`Restore “${restoring.label}”?`}
          message="The setup goes back to how it was in this version. The current setup is saved as a version first, and Undo can step back too. Specs aren't changed — their signs pick up the restored questions the next time they're opened."
          confirmLabel="Restore"
          danger
          onCancel={() => setRestoring(null)}
          onConfirm={() => {
            const v = restoring;
            setRestoring(null);
            setCompare(null);
            void run("Restoring", () => restoreVersion(v.id, v.label, userName, progress("Saving the current setup first")), `Restored “${v.label}”.`);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.label}”?`}
          message="The saved version is removed for good. The setup itself isn't changed."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const v = deleting;
            setDeleting(null);
            if (compare?.id === v.id) setCompare(null);
            void run("Deleting", () => repo().deleteVersion(v.id), "Version deleted.");
          }}
        />
      )}
    </>
  );
}

function VersionRow({
  v,
  busy,
  compare,
  onCompare,
  onRestore,
  onDelete,
}: {
  v: SetupVersion;
  busy: boolean;
  compare: { diff?: SetupDiff; error?: string } | null;
  onCompare: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const st = v.stats;
  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 700 }}>
            {v.label} {v.kind === "auto" && <span className="sbp-pill">automatic</span>}
          </div>
          {v.note && <div className="sbp-muted" style={{ fontSize: 12 }}>{v.note}</div>}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          {when(v.createdAt)}
          {v.createdBy && <div className="sbp-muted" style={{ fontSize: 12 }}>{v.createdBy}</div>}
        </td>
        <td className="sbp-muted" style={{ fontSize: 12 }}>
          {st.categories} categories · {st.signTypes} sign types · {st.questions.toLocaleString()} questions · {st.answers.toLocaleString()} answers ·{" "}
          {st.rules.toLocaleString()} rules · {st.templates} description lines
        </td>
        <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
          <button type="button" className="btn-secondary" onClick={onCompare}>
            {compare ? "Hide changes" : "Changes since"}
          </button>{" "}
          <button type="button" className="btn-secondary" disabled={busy} onClick={onRestore}>
            Restore
          </button>{" "}
          <button type="button" className="btn-secondary" disabled={busy} onClick={onDelete}>
            Delete
          </button>
        </td>
      </tr>
      {compare && (
        <tr>
          <td colSpan={4}>
            {!compare.diff && !compare.error && <div className="sbp-muted">Comparing…</div>}
            {compare.error && <div className="sbp-banner sbp-banner--error">{compare.error}</div>}
            {compare.diff && <DiffView diff={compare.diff} />}
          </td>
        </tr>
      )}
    </>
  );
}

function DiffView({ diff }: { diff: SetupDiff }) {
  if (isSameSetup(diff)) return <div className="sbp-banner sbp-banner--ok">No changes since this version — it matches the current setup.</div>;
  return (
    <div className="sbp-banner" style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Changed since this version (restoring it undoes these):</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {diff.general.length > 0 && <li>{diff.general.join(", ")}</li>}
        {diff.added.map((t) => (
          <li key={`a${t.code}`}>
            <b>New sign type</b> {t.name} <span className="sbp-muted">({t.code})</span>
          </li>
        ))}
        {diff.removed.map((t) => (
          <li key={`r${t.code}`}>
            <b>Removed sign type</b> {t.name} <span className="sbp-muted">({t.code})</span>
          </li>
        ))}
        {diff.changed.map((t) => (
          <li key={`c${t.code}`}>
            {t.name} <span className="sbp-muted">({t.code})</span> — {t.parts.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
