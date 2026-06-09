import { useMemo, useState } from "react";
import { useSpec } from "../../app/SpecContext";
import {
  VINYL_3630,
  VINYL_7725,
  matchesVinylSearch,
  swatchDisplayName,
} from "../../domain/vinylSwatches";
import type { VinylTypeCode } from "../../domain/SignSpec";

const TYPES: { value: VinylTypeCode; label: string }[] = [
  { value: "CV", label: "Cut Vinyl" },
  { value: "DV", label: "Digital Print" },
  { value: "FX", label: "Vehicle / Wrap Film" },
  { value: "NV", label: "No Vinyl" },
];

export function Step8Vinyl() {
  const { spec, setVinyl, setVinylSwatch, update } = useSpec();
  const [search, setSearch] = useState("");

  // Translucent swatches when lighted, opaque otherwise.
  const swatches = useMemo(() => {
    if (spec.vinyl !== "CV") return [];
    const lighted = spec.illumination === "IL" || spec.illumination === "EL";
    const base = lighted ? VINYL_3630 : VINYL_7725;
    return base.filter((s) => matchesVinylSearch(s, search));
  }, [spec.vinyl, spec.illumination, search]);

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>8 · Vinyl / Graphics</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.vinyl}
          onChange={(e) => setVinyl((e.target.value || "") as VinylTypeCode)}
        >
          <option value="">Select…</option>
          {TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {spec.vinyl === "CV" ? (
          <div style={{ marginTop: 14 }}>
            {/* Color search — added on top of the Vercel preview app */}
            <div className="sbp-vinyl-search">
              <input
                type="search"
                className="lum-input sbp-vinyl-search__input"
                placeholder={`Search ${spec.illumination === "NI" ? "3M 7725 Opaque" : "3M 3630 Translucent"} colors…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button
                  type="button"
                  className="sbp-vinyl-search__clear"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="sbp-vinyl-grid">
              {swatches.map((s) => {
                const display = swatchDisplayName(s);
                const active = spec.vinylColor === display;
                return (
                  <button
                    key={`${s.series}-${s.code}`}
                    type="button"
                    className={"sbp-swatch" + (active ? " is-active" : "")}
                    onClick={() => setVinylSwatch(display, s.hex)}
                    title={display}
                  >
                    <div className="sbp-swatch__color" style={{ background: s.hex }} />
                    <div className="sbp-swatch__label">
                      <span className="sbp-swatch__series">3M {s.series}</span>
                      <span className="sbp-swatch__name">{s.code} {s.name}</span>
                    </div>
                  </button>
                );
              })}
              {swatches.length === 0 && search ? (
                <div className="sbp-swatch" style={{ gridColumn: "1 / -1", padding: 14, justifyContent: "center" }}>
                  <span className="sbp-swatch__name" style={{ textAlign: "center" }}>
                    No swatch matches "{search}".
                  </span>
                </div>
              ) : null}
            </div>

            {spec.vinylColor ? (
              <div className="sbp-vinyl-preview" aria-live="polite">
                <div className="sbp-vinyl-preview__swatch" style={{ background: spec.vinylHex }} />
                <div className="sbp-vinyl-preview__label">
                  <span className="sbp-vinyl-preview__name">{spec.vinylColor}</span>
                  <span className="sbp-vinyl-preview__hex">{spec.vinylHex}</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {spec.vinyl === "DV" ? (
          <div style={{ marginTop: 14 }}>
            <span className="lum-field-label">Digital Print Reference</span>
            <input
              className="lum-input"
              placeholder="Art file name or SharePoint link…"
              value={spec.digitalRef}
              onChange={(e) => update({ digitalRef: e.target.value })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
