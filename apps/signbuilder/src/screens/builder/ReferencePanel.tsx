import { useEffect, useState } from "react";
import type { SpecReference } from "../../domain/types";
import { useSetupStore } from "../../store/setup-store";

/** The sign's Sign Specification Reference page: thumbnail; click for the
 *  full page, full screen, with zoom, print, download and the SharePoint link. */
export default function ReferencePanel({ code }: { code: string }) {
  const setup = useSetupStore((s) => s.setup);
  const loadImages = useSetupStore((s) => s.referenceImages);
  const ref = setup?.references.find((r) => r.code === code);
  const [images, setImages] = useState<Pick<SpecReference, "thumbnail" | "fullImage">>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setImages({});
    if (code) void loadImages(code).then((i) => alive && setImages(i));
    return () => {
      alive = false;
    };
  }, [code, loadImages]);

  if (!code) {
    return (
      <div className="sbp-card">
        <div className="sbp-caption">Spec Reference</div>
        <div className="sbp-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Shows the matching reference page once the first questions are answered.
        </div>
      </div>
    );
  }
  const link = ref?.sharePointUrl || setup?.settings.specReferenceFolderUrl || "";
  const thumb = images.thumbnail || images.fullImage;
  return (
    <div className="sbp-card">
      <div className="sbp-caption">Spec Reference · {code}</div>
      <div style={{ fontWeight: 700, margin: "4px 0 8px" }}>{ref?.description ?? code}</div>
      {thumb ? (
        <img className="sbp-ref__thumb" src={thumb} alt={ref?.description ?? code} title="Click to view full size" onClick={() => setOpen(true)} />
      ) : (
        <div className="sbp-muted" style={{ fontSize: 12 }}>
          No image yet.
        </div>
      )}
      <div className="sbp-row" style={{ marginTop: 8 }}>
        {thumb && (
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            View Full Size
          </button>
        )}
        {link && (
          <a className="btn-secondary" href={link} target="_blank" rel="noreferrer">
            SharePoint
          </a>
        )}
      </div>
      {open && <ReferenceViewer title={ref?.description ?? code} fileName={ref?.fileName || code} image={images.fullImage || thumb || ""} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function ReferenceViewer({ title, fileName, image, onClose }: { title: string; fileName: string; image: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Print just the page: a hidden frame holding only the image.
  const print = () => {
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html><head><style>@page{size:letter portrait;margin:0.25in}html,body{margin:0}img{width:100%;max-height:10.4in;object-fit:contain}</style></head><body></body></html>',
    );
    doc.close();
    const img = doc.createElement("img");
    img.onload = () => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 1000);
    };
    img.src = image;
    doc.body.appendChild(img);
  };

  return (
    <div className="sbp-viewer" role="dialog" aria-modal="true">
      <div className="sbp-viewer__bar">
        <strong style={{ flex: 1 }}>{title}</strong>
        <button type="button" className="btn-secondary" onClick={() => setZoomed((z) => !z)}>
          {zoomed ? "Fit to screen" : "Zoom in"}
        </button>
        <button type="button" className="btn-secondary" onClick={print}>
          Print
        </button>
        <a className="btn-secondary" href={image} download={`${fileName}.jpg`}>
          Download
        </a>
        <button type="button" className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="sbp-viewer__stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img className={`sbp-viewer__img${zoomed ? " sbp-viewer__img--zoomed" : ""}`} src={image} alt={title} onClick={() => setZoomed((z) => !z)} />
      </div>
    </div>
  );
}
