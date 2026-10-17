import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/ui";
import type { DesignFile } from "../../domain/types";
import { sharePoint, spSearchUrl, spUrlOf, type SpFile } from "../../services/sharepoint";

/** Design Reference text for the picked files: their names without the extension. */
export function designRefText(files: DesignFile[]): string {
  return files
    .map((f) => f.name.replace(/\.[^.]+$/, ""))
    .join("; ")
    .slice(0, 200);
}

/** Pick the design reference file(s) from the job's SharePoint folder. */
export default function DesignFilesPicker({
  jobNo,
  initial,
  onPick,
  onClose,
}: {
  jobNo: string;
  initial: DesignFile[];
  onPick: (files: DesignFile[]) => void;
  onClose: () => void;
}) {
  const [folder, setFolder] = useState<string | null>(null);
  const [files, setFiles] = useState<SpFile[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Map<string, DesignFile>>(() => new Map(initial.map((f) => [f.ref, f])));

  useEffect(() => {
    let ok = true;
    (async () => {
      const url = await sharePoint().findJobFolder(jobNo);
      if (!ok) return;
      setFolder(url);
      if (!url) return;
      const list = await sharePoint().listFiles(url);
      if (ok) setFiles(list);
    })().catch((e) => ok && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      ok = false;
    };
  }, [jobNo]);

  // Newest first, grouped by subfolder (a group sits where its newest file is).
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Map<string, SpFile[]>();
    for (const f of files ?? []) {
      if (q && !`${f.folder}/${f.name}`.toLowerCase().includes(q)) continue;
      out.set(f.folder, [...(out.get(f.folder) ?? []), f]);
    }
    return [...out.entries()];
  }, [files, query]);

  const toggle = (f: SpFile) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(f.ref)) n.delete(f.ref);
      else n.set(f.ref, { name: f.name, ref: f.ref });
      return n;
    });

  // Files picked before that are no longer in the folder (moved / renamed) stay unless unticked.
  const missing = files ? [...picked.values()].filter((p) => !files.some((f) => f.ref === p.ref)) : [];

  return (
    <Modal
      title={`Design reference — ${jobNo} in SharePoint`}
      onClose={onClose}
      wide
      actions={
        <button type="button" className="btn-primary" disabled={files === null} onClick={() => onPick([...picked.values()])}>
          {picked.size === 0 ? "Use no files" : `Use ${picked.size} file${picked.size === 1 ? "" : "s"}`}
        </button>
      }
    >
      {error && <div className="sbp-banner sbp-banner--error">Couldn't read SharePoint: {error}</div>}
      {!error && folder === null && <div className="sbp-muted">Finding {jobNo}'s folder in SharePoint…</div>}
      {!error && folder === "" && (
        <div className="sbp-banner sbp-banner--warn">
          SharePoint has no folder named {jobNo} yet (a new folder can take a few minutes to show up).{" "}
          <a href={spSearchUrl(jobNo)} target="_blank" rel="noreferrer">
            Search SharePoint for {jobNo}
          </a>
        </div>
      )}
      {folder && (
        <>
          <div className="sbp-row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="sbp-input" autoFocus style={{ flex: 1 }} placeholder="Search file names…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <a className="btn-secondary" href={folder.replace(/ /g, "%20")} target="_blank" rel="noreferrer">
              Open the folder
            </a>
          </div>
          <div className="sbp-muted" style={{ fontSize: 12, marginBottom: 6 }}>
            {decodeURIComponent(folder.replace(/^https:\/\/[^/]+\/sites\/JobFiles\/Shared Documents\//i, ""))} — tick the reference file(s); the names go into Design Reference.
          </div>
          <div className="sbp-picker-list">
            {files === null && <div className="sbp-muted">Loading the files…</div>}
            {files?.length === 0 && <div className="sbp-muted">The folder is empty.</div>}
            {files && files.length > 0 && groups.length === 0 && <div className="sbp-muted">No files match.</div>}
            {groups.map(([sub, list]) => (
              <div key={sub || "."}>
                <div className="sbp-caption" style={{ margin: "6px 0 2px" }}>{sub || "(the job folder)"}</div>
                {list.map((f) => (
                  <label key={f.ref} className={`sbp-picker-row sbp-design-row${picked.has(f.ref) ? " is-picked" : ""}`}>
                    <input type="checkbox" checked={picked.has(f.ref)} onChange={() => toggle(f)} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{f.name}</span>
                    <span className="sbp-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{f.modified}</span>
                    <a href={spUrlOf(f.ref)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      Open
                    </a>
                  </label>
                ))}
              </div>
            ))}
            {missing.length > 0 && (
              <div>
                <div className="sbp-caption" style={{ margin: "6px 0 2px" }}>Picked before — not in the folder now</div>
                {missing.map((f) => (
                  <label key={f.ref} className="sbp-picker-row sbp-design-row is-picked">
                    <input type="checkbox" checked onChange={() => toggle({ ...f, type: "", modified: "", folder: "" })} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{f.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
