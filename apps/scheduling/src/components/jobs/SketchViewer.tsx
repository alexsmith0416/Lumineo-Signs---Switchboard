import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { JobSketch } from "../../store/sketch-store";

/**
 * A job's sketch, full size over the dimmed Jobs list (like Airtable's
 * attachment viewer): pictures as they are, PDFs page by page. Download, Open
 * in SharePoint, and — for editors — Remove (off the Jobs list only; the
 * SharePoint file is never touched). Esc or a click on the dark area closes it.
 */

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
};
const DOWNLOAD_TIMEOUT_MS = 60_000;

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function SketchViewer({
  jobNo,
  sketch,
  canRemove,
  onRemove,
  onClose,
}: {
  jobNo: string;
  sketch: JobSketch;
  canRemove: boolean;
  /** Ask to remove it (opens the confirmation). */
  onRemove: () => void;
  onClose: () => void;
}) {
  const type = (sketch.fileName.split(".").pop() ?? "").toLowerCase();
  const [size, setSize] = useState<number | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    let blobUrl: string | null = null;
    void (async () => {
      if (type !== "pdf" && !IMAGE_TYPES[type]) {
        setError(`There's no preview for .${type || "?"} files — use Download or Open in SharePoint.`);
        setLoading(false);
        return;
      }
      try {
        const sp = await import("../../services/sharepoint");
        const bytes = await Promise.race([
          sp.fileBytes(sp.sketchFileRef(sketch)),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Downloading the file took too long")), DOWNLOAD_TIMEOUT_MS)),
        ]);
        if (!alive) return;
        setSize(bytes.length);
        if (type === "pdf") {
          const render = await import("../../services/sketch-render");
          const width = Math.min(1600, Math.round(window.innerWidth * 0.8 * (window.devicePixelRatio || 1)));
          await render.pdfPages(bytes, width, 20, (i, url, total) => {
            if (!alive) return;
            setPageTotal(total);
            setPages((p) => {
              const next = [...p];
              next[i] = url;
              return next;
            });
            setLoading(false);
          });
        } else {
          blobUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: IMAGE_TYPES[type] }));
          setImage(blobUrl);
        }
      } catch (e) {
        if (alive) setError(`Couldn't load it: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sketch, type]);

  const openInSharePoint = () => window.open(sketch.fileUrl, "_blank", "noopener");
  const download = () =>
    void import("../../services/sharepoint").then((sp) => window.open(sp.downloadUrlOf(sp.sketchFileRef(sketch)), "_blank", "noopener"));

  return createPortal(
    // Clicks are stopped here: a portal still bubbles through the React tree,
    // and the row underneath would open the job panel.
    <div
      className="sketch-viewer"
      role="dialog"
      aria-label={`Sketch for ${jobNo}`}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onContextMenu={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="sketch-viewer__top" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sketch-viewer__close" onClick={onClose} aria-label="Close" title="Close (Esc)">
          ✕
        </button>
        <div className="sketch-viewer__name" title={sketch.fileName}>
          {sketch.fileName}
        </div>
        <div className="sketch-viewer__job">{jobNo}</div>
      </div>

      <div className="sketch-viewer__stage">
        {loading && !error && <div className="sketch-viewer__msg">Loading {type === "pdf" ? "the PDF" : "the picture"}…</div>}
        {error && (
          <div className="sketch-viewer__msg" onClick={(e) => e.stopPropagation()}>
            {error}
          </div>
        )}
        {image && <img className="sketch-viewer__image" src={image} alt={sketch.fileName} onClick={(e) => e.stopPropagation()} />}
        {pages.length > 0 && (
          <div className="sketch-viewer__pages" onClick={(e) => e.stopPropagation()}>
            {pages.map((p, i) => (p ? <img key={i} src={p} alt={`Page ${i + 1}`} /> : null))}
            {pageTotal > pages.length && (
              <div className="sketch-viewer__more">
                {pages.length < Math.min(pageTotal, 20)
                  ? "Loading more pages…"
                  : `Showing the first 20 of ${pageTotal} pages — open it in SharePoint for the rest.`}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sketch-viewer__bottom" onClick={(e) => e.stopPropagation()}>
        <div className="sketch-viewer__meta">
          {(type || "file").toUpperCase()}
          {size != null && ` · ${fileSize(size)}`}
          {pageTotal > 1 && ` · ${pageTotal} pages`}
          {sketch.pinned ? " · chosen in the app" : " · picked automatically"}
        </div>
        <div className="sketch-viewer__actions">
          {canRemove && (
            <button type="button" className="sketch-viewer__btn" onClick={onRemove} title="Remove from the Jobs list (the SharePoint file stays)">
              Remove
            </button>
          )}
          <button type="button" className="sketch-viewer__btn" onClick={openInSharePoint}>
            Open in SharePoint
          </button>
          <button type="button" className="sketch-viewer__btn sketch-viewer__btn--primary" onClick={download}>
            Download
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** "Are you sure?" for Remove File — makes clear nothing is deleted in SharePoint. */
export function RemoveSketchConfirm({
  jobNo,
  fileName,
  onCancel,
  onConfirm,
}: {
  jobNo: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="modal-scrim sketch-remove"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
      onContextMenu={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Remove the sketch">
        <div className="modal-card__title">Remove this sketch from the Jobs list?</div>
        <div className="modal-card__body">
          <p>
            <strong>{fileName}</strong> will no longer show as {jobNo}'s sketch.
          </p>
          <p>
            This does <strong>not</strong> delete anything — the file stays in the job's SharePoint folder. The sketch
            won't be picked again automatically; choose or upload a file any time to set one again.
          </p>
        </div>
        <div className="modal-card__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Remove from Jobs list
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
