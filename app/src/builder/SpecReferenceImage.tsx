// Spec reference image thumbnail + the full-screen modal (ALE-50).
// Thumb (bundled, 144×108) appears once a face type is chosen for cabinets,
// or as soon as the sign type is set for letters / pans / EMC / post-panel.
// Tapping it opens the modal at the full-size image; close on ✕, background
// tap, or Escape.

import { useEffect, useState } from "react";
import { useSpec } from "../app/SpecContext";
import { getSpecReferenceImage, SPEC_PAGES_FOLDER_URL } from "../domain/specReferenceImage";

export function SpecReferenceImage() {
  const { spec } = useSpec();
  const [open, setOpen] = useState(false);

  // Close modal on Escape.
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const ref = getSpecReferenceImage(spec);
  if (!ref) return null;

  return (
    <>
      <div className="sbp-refimage">
        <button
          type="button"
          className="sbp-refimage__thumb"
          onClick={() => setOpen(true)}
          aria-label={`Open full spec page: ${ref.caption}`}
        >
          <img src={ref.thumb} alt={`Spec reference: ${ref.caption}`} />
        </button>
        <div className="sbp-refimage__hint">
          <span className="lum-field-label">Spec Reference</span>
          <span className="sbp-refimage__hint-text">{ref.caption}</span>
          <span className="sbp-refimage__hint-text" style={{ opacity: 0.7 }}>
            Tap image to expand
          </span>
          <a
            className="sbp-refimage__sharepoint"
            href={SPEC_PAGES_FOLDER_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open SharePoint folder ↗
          </a>
        </div>
      </div>

      {open ? (
        <div
          className="sbp-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Spec reference image — ${ref.caption}`}
          onClick={(e) => {
            // Close on background tap only.
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
            <img className="sbp-modal__img" src={ref.full} alt={ref.caption} />
            <figcaption className="sbp-modal__caption">
              {ref.caption}
              {" "}
              <a
                className="sbp-modal__caption-link"
                href={SPEC_PAGES_FOLDER_URL}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
              >
                Open in SharePoint ↗
              </a>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
