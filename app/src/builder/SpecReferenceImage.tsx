// Spec reference image thumbnail + the full-screen modal. The thumbnail shows
// once a face type is selected (per ALE-50). Tapping it opens the modal;
// closing happens on ✕, on background tap, or on Escape.

import { useEffect, useState } from "react";
import { useSpec } from "../app/SpecContext";
import { getSpecReferenceImage } from "../domain/specReferenceImage";

export function SpecReferenceImage() {
  const { spec } = useSpec();
  const [open, setOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const ref = getSpecReferenceImage(spec);

  // Close modal on Escape.
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Reset the load-state probe whenever the lookup changes so we re-try the
  // SharePoint URL for the new sign/face type combo.
  useEffect(() => {
    setImageLoaded(false);
  }, [ref?.href]);

  if (!ref) return null;

  // Probe whether the SharePoint URL is reachable. We optimistically render
  // the placeholder and swap to the real image once <img> fires onLoad.
  const src = imageLoaded && ref.href ? ref.href : ref.placeholder;

  return (
    <>
      <div className="sbp-refimage">
        <div className="sbp-refimage__thumb-wrap">
          <button
            type="button"
            className="sbp-refimage__thumb"
            onClick={() => setOpen(true)}
            aria-label="Open spec reference image"
          >
            <img src={src} alt={`Spec reference for ${spec.productCode || "this sign"}`} />
          </button>
          {/* Hidden probe — when the real SharePoint URL loads, swap to it. */}
          {ref.href ? (
            <img
              src={ref.href}
              alt=""
              aria-hidden
              style={{ display: "none" }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(false)}
            />
          ) : null}
        </div>
        <div className="sbp-refimage__hint">
          <span className="lum-field-label">Spec Reference</span>
          <span className="sbp-refimage__hint-text">Tap image to expand</span>
        </div>
      </div>

      {open ? (
        <div
          className="sbp-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Spec reference image"
          onClick={(e) => {
            // Close on background tap only — not on image click.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <button
            type="button"
            className="sbp-modal__close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
          <figure className="sbp-modal__figure">
            <img className="sbp-modal__img" src={src} alt="" />
            <figcaption className="sbp-modal__caption">{ref.caption}</figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
