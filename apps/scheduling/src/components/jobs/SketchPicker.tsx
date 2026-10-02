import { useEffect, useMemo, useRef, useState } from "react";
import type { JobRow } from "../../services/job-tracking";
import { useSketchStore } from "../../store/sketch-store";

const SKETCH_TYPES = new Set(["pdf", "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "tif", "tiff"]);

interface SpFile {
  name: string;
  fileRef: string;
  type: string;
  modified: string;
  folder: string;
}

/**
 * "Choose the sketch" for a job: the files in its SharePoint folder (and
 * subfolders), newest first — PDFs and pictures unless "Show all files" — with
 * a preview of the one selected. "Use this file" pins it as the job's sketch;
 * "Upload a file…" adds a new one to the job folder and pins that.
 */
export default function SketchPicker({ row, onClose }: { row: JobRow; onClose: () => void }) {
  const sketch = useSketchStore((s) => s.byJob.get(row.jobNo));
  const chooseFile = useSketchStore((s) => s.chooseFile);
  const uploadFile = useSketchStore((s) => s.uploadFile);
  const unpin = useSketchStore((s) => s.unpin);
  const [files, setFiles] = useState<SpFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<SpFile | null>(null);
  const [preview, setPreview] = useState<{ fileRef: string; url: string; error?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void import("../../services/sharepoint")
      .then((sp) => sp.listJobFiles(row.sharepointUrl))
      .then((f) => alive && setFiles(f))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [row.sharepointUrl]);

  // Preview the selected file.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setPreview(null);
    void import("../../services/sketch-render")
      .then((r) => r.renderSketchThumbnailDetailed(selected.fileRef))
      .then((r) => alive && setPreview({ fileRef: selected.fileRef, url: r.dataUrl, error: r.error }));
    return () => {
      alive = false;
    };
  }, [selected]);

  const shown = useMemo(
    () => (files ?? []).filter((f) => showAll || SKETCH_TYPES.has(f.type)),
    [files, showAll],
  );

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await job();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <div className="slide-over" onClick={busy ? undefined : onClose}>
      <div className="slide-over__panel slide-over__panel--wide sketch-picker" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Sketch · {row.job}</div>
        <div className="slide-over__body sketch-picker__body">
          <p className="billing-periods-panel__note">
            {sketch ? (
              <>
                Now: <strong>{sketch.fileName}</strong>
                {sketch.pinned ? " (chosen here)" : " (picked automatically)"}.{" "}
              </>
            ) : (
              "No sketch yet. "
            )}
            Pick a file from the job's SharePoint folder, or upload a new one.
          </p>
          <div className="sketch-picker__cols">
            <div className="sketch-picker__list">
              {files === null && !error && <div className="jobs-jobpanel__muted">Loading the job's files…</div>}
              {files && shown.length === 0 && (
                <div className="jobs-jobpanel__muted">
                  No {showAll ? "" : "PDFs or pictures "}in this job's folder.
                </div>
              )}
              {shown.map((f) => (
                <button
                  key={f.fileRef}
                  type="button"
                  className={`sketch-picker__file${selected?.fileRef === f.fileRef ? " sketch-picker__file--on" : ""}${
                    sketch?.fileName === f.name ? " sketch-picker__file--current" : ""
                  }`}
                  onClick={() => setSelected(f)}
                  onDoubleClick={() => void run("Saving…", () => chooseFile(row.jobNo, f.fileRef))}
                >
                  <span className="sketch-picker__type">{f.type.toUpperCase() || "FILE"}</span>
                  <span className="sketch-picker__name">{f.name}</span>
                  <span className="sketch-picker__meta">
                    {f.folder ? `${f.folder} · ` : ""}
                    {f.modified}
                  </span>
                </button>
              ))}
            </div>
            <div className="sketch-picker__preview">
              {!selected ? (
                <span className="jobs-jobpanel__muted">Select a file to preview it.</span>
              ) : preview?.fileRef !== selected.fileRef ? (
                <span className="jobs-jobpanel__muted">Loading preview…</span>
              ) : preview.url ? (
                <img src={preview.url} alt={selected.name} />
              ) : (
                <span className="jobs-jobpanel__muted">{preview.error ?? "No preview for this file."}</span>
              )}
            </div>
          </div>
          <label className="sketch-picker__all">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all files
          </label>
          {error && <div className="jobs-sync__error">{error}</div>}
          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(`Uploading ${f.name}…`, () => uploadFile(row.jobNo, row.sharepointUrl, f));
            }}
          />
        </div>
        <div className="users-admin__footer" style={{ gap: 8, flexWrap: "wrap" }}>
          {/* Also offered when there's no sketch — e.g. after Remove File — to
              let the nightly search pick one again. */}
          {(sketch?.pinned || !sketch) && (
            <button
              className="btn-secondary"
              disabled={!!busy}
              title="Let the nightly sketch search pick the file again (from tonight's run)"
              onClick={() => void run("Saving…", () => unpin(row.jobNo))}
            >
              Use the automatic pick
            </button>
          )}
          <button className="btn-secondary" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            Upload a file…
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn-secondary" disabled={!!busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!selected || !!busy}
            onClick={() => selected && void run("Saving…", () => chooseFile(row.jobNo, selected.fileRef))}
          >
            {busy ?? "Use this file"}
          </button>
        </div>
      </div>
    </div>
  );
}
