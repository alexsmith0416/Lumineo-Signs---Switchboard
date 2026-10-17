import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSketchStore } from "../../store/sketch-store";
import SketchPicker from "./SketchPicker";
import SketchViewer, { RemoveSketchConfirm } from "./SketchViewer";

export interface JobSketchProps {
  jobNo: string;
  /** The job's SharePoint folder — needed to upload / choose a file. */
  sharepointUrl: string;
  /** Shown in the chooser's title ("Sketch · <label>"). */
  label: string;
  canEdit: boolean;
  /** Open the chooser elsewhere (the Jobs grid keeps it outside its virtual
   *  rows); without it the component opens its own. */
  onOpenPicker?: () => void;
  /** "cell" = the Jobs list cell; "panel" = larger, for the card panel. */
  size?: "cell" | "panel";
}

/** The job's sketch: a thumbnail that opens the file full size in the sketch
 *  viewer; a larger preview on hover. Editors drop a file on it to upload it to
 *  the job's SharePoint folder as the sketch, or right-click to choose / upload /
 *  go back to the automatic pick / remove it from the list (never deleting the
 *  SharePoint file). Blank when the job has no sketch (and it can't be edited).
 *  Shared by the Jobs list Sketch cell and the schedule card panel. */
export default function JobSketch({ jobNo, sharepointUrl, label, canEdit, onOpenPicker, size = "cell" }: JobSketchProps) {
  const sketch = useSketchStore((s) => s.byJob.get(jobNo));
  const thumb = useSketchStore((s) => s.thumbs.get(jobNo));
  const load = useSketchStore((s) => s.load);
  const wantThumb = useSketchStore((s) => s.wantThumb);
  const uploadFile = useSketchStore((s) => s.uploadFile);
  const unpin = useSketchStore((s) => s.unpin);
  const removeSketch = useSketchStore((s) => s.remove);
  const [viewing, setViewing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ busy: boolean; text: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [ownPicker, setOwnPicker] = useState(false);
  useEffect(() => {
    void load(); // no-op once the list is loaded (the Jobs list loads it too)
  }, [load]);
  useEffect(() => {
    if (sketch) wantThumb(jobNo);
  }, [sketch, jobNo, wantThumb]);

  const openPicker = onOpenPicker ?? (() => setOwnPicker(true));
  const editable = canEdit && !!sharepointUrl;
  const upload = async (file: File) => {
    setStatus({ busy: true, text: `Uploading ${file.name}…` });
    try {
      await uploadFile(jobNo, sharepointUrl, file);
      setStatus(null);
    } catch (e) {
      setStatus({ busy: false, text: `Upload failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const isPdf = sketch ? /\.pdf$/i.test(sketch.fileName) : false;
  if (size === "panel" && !sketch && !editable) return null;

  return (
    <div
      className={`jobs-sketch-cell${size === "panel" ? " jobs-sketch-cell--panel" : ""}${dragOver ? " jobs-sketch-cell--drop" : ""}${editable && !sketch ? " jobs-sketch-cell--empty" : ""}`}
      title={editable ? (sketch ? undefined : "Drop a file here, or right-click, to add the sketch") : undefined}
      onClick={(e) => editable && !sketch && (e.stopPropagation(), openPicker())}
      onContextMenu={
        editable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
      onDragOver={
        editable
          ? (e) => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={() => setDragOver(false)}
      onDrop={
        editable
          ? (e) => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void upload(file);
            }
          : undefined
      }
    >
      {status ? (
        <span className={`jobs-sketch__status${status.busy ? "" : " jobs-sketch__status--error"}`} title={status.text}>
          {status.busy ? "Uploading…" : "Failed"}
        </span>
      ) : sketch ? (
        <button
          type="button"
          className="jobs-sketch"
          title={`${sketch.fileName}${sketch.pinned ? " (chosen)" : ""} — click to view`}
          onClick={(e) => {
            e.stopPropagation();
            setHover(null);
            setViewing(true);
          }}
          onMouseEnter={(e) => thumb && setHover(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
        >
          {thumb ? <img src={thumb} alt={sketch.fileName} /> : <span className="jobs-sketch__file">{isPdf ? "PDF" : "FILE"}</span>}
        </button>
      ) : editable ? (
        <span className="jobs-sketch__add">{size === "panel" ? "+ Add a sketch" : "+"}</span>
      ) : null}
      {hover &&
        thumb &&
        sketch &&
        createPortal(
          <div
            className="jobs-sketch-preview"
            style={{
              top: Math.max(8, Math.min(hover.top - 60, window.innerHeight - 268)),
              left: hover.right + 8 + 330 > window.innerWidth ? hover.left - 338 : hover.right + 8,
            }}
          >
            <img src={thumb} alt="" />
            <div className="jobs-sketch-preview__name">{sketch.fileName}</div>
          </div>,
          document.body,
        )}
      {menu &&
        createPortal(
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu(null);
              }}
            />
            <div
              className="job-context-menu"
              style={{ position: "fixed", top: Math.min(menu.y, window.innerHeight - 190), left: Math.min(menu.x, window.innerWidth - 230), zIndex: 301 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="job-context-menu__head">Sketch · {jobNo}</div>
              {sketch && (
                <button type="button" onClick={() => (setMenu(null), setViewing(true))}>
                  View
                </button>
              )}
              {sketch && (
                <button type="button" onClick={() => (window.open(sketch.fileUrl, "_blank", "noopener"), setMenu(null))}>
                  Open in SharePoint
                </button>
              )}
              <button type="button" onClick={() => (setMenu(null), openPicker())}>
                Choose a different file…
              </button>
              <label className="job-context-menu__file">
                Upload a file…
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setMenu(null);
                    if (f) void upload(f);
                  }}
                />
              </label>
              {sketch?.pinned && (
                <button type="button" onClick={() => (setMenu(null), void unpin(jobNo))}>
                  Use the automatic pick
                </button>
              )}
              {sketch && (
                <button type="button" className="job-context-menu__danger" onClick={() => (setMenu(null), setConfirmRemove(true))}>
                  Remove File
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
      {viewing && sketch && (
        <SketchViewer
          jobNo={jobNo}
          sketch={sketch}
          canRemove={editable}
          onRemove={() => setConfirmRemove(true)}
          onClose={() => setViewing(false)}
        />
      )}
      {confirmRemove && sketch && (
        <RemoveSketchConfirm
          jobNo={jobNo}
          fileName={sketch.fileName}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false);
            setViewing(false);
            void removeSketch(jobNo);
          }}
        />
      )}
      {ownPicker && <SketchPicker row={{ jobNo, sharepointUrl, job: label }} onClose={() => setOwnPicker(false)} />}
    </div>
  );
}

/** Small read-only thumbnail for the card hover preview (no hover / click —
 *  the preview ignores the pointer). Nothing until the thumbnail is in. */
export function SketchThumb({ jobNo }: { jobNo: string }) {
  const sketch = useSketchStore((s) => s.byJob.get(jobNo));
  const thumb = useSketchStore((s) => s.thumbs.get(jobNo));
  const load = useSketchStore((s) => s.load);
  const wantThumb = useSketchStore((s) => s.wantThumb);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (sketch) wantThumb(jobNo);
  }, [sketch, jobNo, wantThumb]);
  if (!sketch || !thumb) return null;
  return <img className="card-tooltip__sketch" src={thumb} alt={sketch.fileName} />;
}
