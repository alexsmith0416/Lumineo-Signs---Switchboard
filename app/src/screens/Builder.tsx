import { useMemo, useState } from "react";
import { useSpec } from "../app/SpecContext";
import { SIGN_TYPES, getSignType, isLetter, isPan, POLE_FOOTING_TYPES } from "../domain/signTypes";
import type { SignTypeCode } from "../domain/signTypes";
import { Banner } from "../ui/Banner";
import { Step1SignType } from "../builder/steps/Step1SignType";
import { Step1bFabrication } from "../builder/steps/Step1bFabrication";
import { Step2Faces } from "../builder/steps/Step2Faces";
import { Step3Dimensions } from "../builder/steps/Step3Dimensions";
import { Step4Illumination } from "../builder/steps/Step4Illumination";
import { Step5LED } from "../builder/steps/Step5LED";
import { Step6FaceType } from "../builder/steps/Step6FaceType";
import { Step6bRoutedBacker } from "../builder/steps/Step6bRoutedBacker";
import { Step7Finish } from "../builder/steps/Step7Finish";
import { Step8Vinyl } from "../builder/steps/Step8Vinyl";
import { Step9Mounting } from "../builder/steps/Step9Mounting";
import { Step10Pole } from "../builder/steps/Step10Pole";
import { Step11Footing } from "../builder/steps/Step11Footing";
import { Step12Electrical } from "../builder/steps/Step12Electrical";
import { SpecSummary } from "../builder/SpecSummary";
import { SpecReferenceImage } from "../builder/SpecReferenceImage";

export function Builder() {
  const { spec, recent, loadSpec, update, clearAll, saveSpec, saveStatus, exportSpecHtml } = useSpec();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => recent.filter((s) => {
    if (typeFilter && s.signTypeCode !== typeFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [s.customerName, s.projectName, s.productCode]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  }), [recent, query, typeFilter]);

  return (
    <div className="sbp-builder">
      <aside className="sbp-sidebar">
        <div className="sbp-sidebar__title">Recent Specs</div>
        <input
          className="sbp-sidebar__search"
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="sbp-sidebar__filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All sign types</option>
          {SIGN_TYPES.map((t) => (
            <option key={t.code} value={t.code}>{t.name}</option>
          ))}
        </select>
        <div className="sbp-sidebar__list">
          {filtered.length === 0 ? (
            <div className="sbp-sidebar__empty">No saved specs match.</div>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"sbp-sidebar__item" + (s.id === spec.id ? " is-active" : "")}
                onClick={() => loadSpec(s)}
                title={`${s.customerName || ""} ${s.projectName || ""}`.trim()}
              >
                <span className="sbp-sidebar__item-code">{s.productCode || "(no code)"}</span>
                <span className="sbp-sidebar__item-meta">
                  {s.projectName || s.customerName || getSignType(s.signTypeCode || "")?.name || "—"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="sbp-form">
        <div className="sbp-topbar">
          <span className="sbp-topbar__title">New Specification</span>
          <div className="sbp-topbar__field sbp-topbar__input">
            <span className="sbp-topbar__field-label">Customer</span>
            <input
              className="lum-input"
              value={spec.customerName}
              onChange={(e) => update({ customerName: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div className="sbp-topbar__field sbp-topbar__input">
            <span className="sbp-topbar__field-label">Project</span>
            <input
              className="lum-input"
              value={spec.projectName}
              onChange={(e) => update({ projectName: e.target.value })}
              placeholder="Project name"
            />
          </div>
          <div className="sbp-topbar__field sbp-topbar__qty">
            <span className="sbp-topbar__field-label">Qty</span>
            <input
              className="lum-input"
              type="number"
              min={1}
              value={spec.quantity}
              onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
          <div className="sbp-topbar__actions">
            <button
              type="button"
              className="lum-btn is-ghost"
              onClick={exportSpecHtml}
              disabled={!spec.productCode}
            >
              Export Spec
            </button>
            <button
              type="button"
              className="lum-btn is-primary"
              onClick={saveSpec}
              disabled={!spec.signTypeCode || saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Spec"}
            </button>
            <button
              type="button"
              className="lum-btn is-danger"
              onClick={clearAll}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="sbp-form__scroll">
          <SpecSummary />
          {saveStatus === "error" && !spec.signTypeCode ? (
            <Banner tone="amber">Please select a sign type first.</Banner>
          ) : null}

          <Step1SignType />
          {isLetter(spec.signTypeCode || "") ? <Step1bFabrication /> : null}
          {spec.signTypeCode ? <Step2Faces /> : null}
          {spec.faces && !isLetter(spec.signTypeCode || "") && !isPan(spec.signTypeCode || "") ? (
            <Step3Dimensions />
          ) : null}
          {spec.faces ? <Step4Illumination /> : null}
          {(spec.illumination === "IL" || spec.illumination === "EL") ? <Step5LED /> : null}
          {spec.illumination ? <Step6FaceType /> : null}
          {(spec.faceType === "RFPB" || spec.faceType === "RFPT") ? <Step6bRoutedBacker /> : null}
          {spec.faceType && !spec.outsourced ? <Step7Finish /> : null}
          {spec.faceType ? <Step8Vinyl /> : null}
          {spec.faceType ? <Step9Mounting /> : null}

          {/* Steps 10/11/12 — ground-mount cabinets only (MN/PS/PP), once mounting is set */}
          {POLE_FOOTING_TYPES.includes(spec.signTypeCode as SignTypeCode) && spec.mounting ? (
            <>
              <Step10Pole />
              <Step11Footing />
              <Step12Electrical />
            </>
          ) : null}

          {/* Spec reference image — once a face type is picked */}
          {spec.faceType ? <SpecReferenceImage /> : null}

          {!spec.signTypeCode ? (
            <div className="sbp-empty">Pick a sign type in step 1 to start the cascade.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
