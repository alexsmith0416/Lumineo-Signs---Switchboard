import { useEffect, useMemo, useState } from "react";
import { useSpec } from "../app/SpecContext";
import { useLaunchParams } from "../app/launchParams";
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
import { StepNotesStatus } from "../builder/steps/StepNotesStatus";
import { SpecSummary } from "../builder/SpecSummary";
import { SpecReferenceImage } from "../builder/SpecReferenceImage";
import { statusTone } from "../ui/specStatus";

export function Builder() {
  const { spec, recent, projects, loadSpec, update, clearAll, saveSpec, saveStatus, exportSpecHtml } = useSpec();
  const { specId } = useLaunchParams();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deepLinked, setDeepLinked] = useState(false);

  // Deep-link from Switchboard / Project Scheduler: ?specId=... preloads a
  // saved spec on first mount. Runs once per specId, after recent has loaded.
  useEffect(() => {
    if (!specId || deepLinked || recent.length === 0) return;
    const target = recent.find((s) => s.id === specId);
    if (target) {
      loadSpec(target);
      setDeepLinked(true);
    }
  }, [specId, recent, deepLinked, loadSpec]);

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
                <div className="sbp-sidebar__item-head">
                  <span className="sbp-sidebar__item-code">{s.productCode || "(no code)"}</span>
                  <span className={`sbp-sidebar__item-status is-${statusTone(s.status)}`}>
                    {s.status}
                  </span>
                </div>
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
          <span className="sbp-topbar__title">
            {spec.id ? "Edit Spec" : "New Spec"}
          </span>
          <div className="sbp-topbar__field sbp-topbar__input">
            <span className="sbp-topbar__field-label">Sign Name</span>
            <input
              className="lum-input"
              value={spec.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="e.g. Main Entry Cabinet"
            />
          </div>
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
            <select
              className="lum-select"
              value={spec.projectId ?? ""}
              onChange={(e) => {
                const id = e.target.value || undefined;
                const proj = projects.find((p) => p.id === id);
                update({ projectId: id, projectName: proj?.name ?? "" });
              }}
            >
              <option value="">— None / standalone —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name || "Untitled"}</option>
              ))}
            </select>
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

          {spec.id ? (
            <Banner tone="info">
              Editing saved spec <strong>{spec.productCode || spec.id}</strong>
              {spec.customerName ? <> · {spec.customerName}</> : null}
              {spec.projectName ? <> · {spec.projectName}</> : null}
            </Banner>
          ) : null}

          {saveStatus === "error" ? (
            <Banner tone={spec.signTypeCode ? "red" : "amber"}>
              {spec.signTypeCode
                ? "Save failed — please try again, or check the network / Dataverse connection."
                : "Please select a sign type first."}
            </Banner>
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

          {/* Notes + status card always renders once the user has started a spec */}
          {spec.signTypeCode ? <StepNotesStatus /> : null}

          {!spec.signTypeCode ? (
            <div className="sbp-empty">Pick a sign type in step 1 to start the cascade.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
