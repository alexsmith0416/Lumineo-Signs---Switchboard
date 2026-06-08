// Ballpark price modal — shows the rough cost breakdown the local
// `computeBallpark()` function produces, with a clear disclaimer that the
// real estimate comes from the Estimating app once the BC catalog is
// connected. Two CTAs: copy a one-line summary to the clipboard, or send
// to Estimating to start a real estimate.

import { useEffect } from "react";
import { computeBallpark, formatUsd } from "../domain/ballpark";
import { mapSpecToEstimatePieces } from "../domain/estimateMapping";
import { sendSpecToEstimating } from "../data/estimatingService";
import type { SignSpec } from "../domain/SignSpec";

type BallparkModalProps = {
  spec: SignSpec;
  onClose: () => void;
};

export function BallparkModal({ spec, onClose }: BallparkModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pieces = mapSpecToEstimatePieces(spec);
  const quote = computeBallpark(pieces);

  function copySummary() {
    const lines = [
      `Ballpark for ${spec.name || spec.productCode || "this sign"}: ${formatUsd(quote.total)}`,
      `Material ~${formatUsd(quote.materialCost)} · Labor ~${quote.laborHours.toFixed(1)}h @ ~${formatUsd(quote.laborCost)}`,
      "Rough estimate — confirm with Estimating for a binding number.",
    ];
    try { navigator.clipboard?.writeText(lines.join("\n")); } catch { /* ignore */ }
  }

  function openInEstimating() {
    sendSpecToEstimating(spec);
    onClose();
  }

  return (
    <div
      className="sbp-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Ballpark price"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sbp-ballpark">
        <button
          type="button"
          className="sbp-modal__close"
          aria-label="Close"
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 12 }}
        >×</button>

        <div className="sbp-ballpark__head">
          <span className="lum-section-label">Ballpark price</span>
          <h2 className="sbp-ballpark__title">{formatUsd(quote.total)}</h2>
          <p className="sbp-ballpark__caption">
            Rough estimate computed locally — confirm with the Estimating app
            for a binding number once it's wired to the BC catalog.
          </p>
        </div>

        {pieces.length === 0 ? (
          <div className="sbp-list-empty">
            Pick a sign type + dimensions before requesting a ballpark.
          </div>
        ) : (
          <div className="sbp-ballpark__table">
            <div className="sbp-ballpark__row sbp-ballpark__row--head">
              <span style={{ flex: 2 }}>Piece</span>
              <span style={{ flex: 1, textAlign: "right" }}>Qty</span>
              <span style={{ flex: 1, textAlign: "right" }}>sqft</span>
              <span style={{ flex: 1, textAlign: "right" }}>Material</span>
              <span style={{ flex: 1, textAlign: "right" }}>Labor</span>
              <span style={{ flex: 1, textAlign: "right" }}>Total</span>
            </div>
            {quote.lines.map((l, i) => (
              <div key={i} className="sbp-ballpark__row">
                <span style={{ flex: 2, fontWeight: 700 }}>{l.pieceType}</span>
                <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{l.qty}</span>
                <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{l.sqftEach.toFixed(1)}</span>
                <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{formatUsd(l.materialEach * l.qty)}</span>
                <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{formatUsd(l.laborCostEach * l.qty)}</span>
                <span style={{ flex: 1, textAlign: "right", fontWeight: 800 }} className="lum-num">{formatUsd(l.total)}</span>
              </div>
            ))}
            <div className="sbp-ballpark__row sbp-ballpark__row--foot">
              <span style={{ flex: 2 }}>Total</span>
              <span style={{ flex: 1 }} />
              <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{quote.laborHours.toFixed(1)}h</span>
              <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{formatUsd(quote.materialCost)}</span>
              <span style={{ flex: 1, textAlign: "right" }} className="lum-num">{formatUsd(quote.laborCost)}</span>
              <span style={{ flex: 1, textAlign: "right", fontWeight: 800, fontSize: 16 }} className="lum-num">
                {formatUsd(quote.total)}
              </span>
            </div>
          </div>
        )}

        <div className="sbp-ballpark__actions">
          <button type="button" className="lum-btn" onClick={copySummary}>
            Copy summary
          </button>
          <button type="button" className="lum-btn is-primary" onClick={openInEstimating}>
            → Send to Estimating
          </button>
        </div>
      </div>
    </div>
  );
}
