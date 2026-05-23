import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useSpec } from "../app/SpecContext";
import { SIGN_TYPES, getSignType, isLetter, isPan } from "../domain/signTypes";
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
import { SpecSummary } from "../builder/SpecSummary";
export function Builder() {
    const { spec, recent, loadSpec, update, clearAll, saveSpec, saveStatus, exportSpecHtml } = useSpec();
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const filtered = useMemo(() => recent.filter((s) => {
        if (typeFilter && s.signTypeCode !== typeFilter)
            return false;
        if (!query.trim())
            return true;
        const q = query.trim().toLowerCase();
        return [s.customerName, s.projectName, s.productCode]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q));
    }), [recent, query, typeFilter]);
    return (_jsxs("div", { className: "sbp-builder", children: [_jsxs("aside", { className: "sbp-sidebar", children: [_jsx("div", { className: "sbp-sidebar__title", children: "Recent Specs" }), _jsx("input", { className: "sbp-sidebar__search", type: "search", placeholder: "Search\u2026", value: query, onChange: (e) => setQuery(e.target.value) }), _jsxs("select", { className: "sbp-sidebar__filter", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), children: [_jsx("option", { value: "", children: "All sign types" }), SIGN_TYPES.map((t) => (_jsx("option", { value: t.code, children: t.name }, t.code)))] }), _jsx("div", { className: "sbp-sidebar__list", children: filtered.length === 0 ? (_jsx("div", { className: "sbp-sidebar__empty", children: "No saved specs match." })) : (filtered.map((s) => (_jsxs("button", { type: "button", className: "sbp-sidebar__item" + (s.id === spec.id ? " is-active" : ""), onClick: () => loadSpec(s), title: `${s.customerName || ""} ${s.projectName || ""}`.trim(), children: [_jsx("span", { className: "sbp-sidebar__item-code", children: s.productCode || "(no code)" }), _jsx("span", { className: "sbp-sidebar__item-meta", children: s.projectName || s.customerName || getSignType(s.signTypeCode || "")?.name || "—" })] }, s.id)))) })] }), _jsxs("section", { className: "sbp-form", children: [_jsxs("div", { className: "sbp-topbar", children: [_jsx("span", { className: "sbp-topbar__title", children: "New Specification" }), _jsxs("div", { className: "sbp-topbar__field sbp-topbar__input", children: [_jsx("span", { className: "sbp-topbar__field-label", children: "Customer" }), _jsx("input", { className: "lum-input", value: spec.customerName, onChange: (e) => update({ customerName: e.target.value }), placeholder: "Customer name" })] }), _jsxs("div", { className: "sbp-topbar__field sbp-topbar__input", children: [_jsx("span", { className: "sbp-topbar__field-label", children: "Project" }), _jsx("input", { className: "lum-input", value: spec.projectName, onChange: (e) => update({ projectName: e.target.value }), placeholder: "Project name" })] }), _jsxs("div", { className: "sbp-topbar__field sbp-topbar__qty", children: [_jsx("span", { className: "sbp-topbar__field-label", children: "Qty" }), _jsx("input", { className: "lum-input", type: "number", min: 1, value: spec.quantity, onChange: (e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) }) })] }), _jsxs("div", { className: "sbp-topbar__actions", children: [_jsx("button", { type: "button", className: "lum-btn is-ghost", onClick: exportSpecHtml, disabled: !spec.productCode, children: "Export Spec" }), _jsx("button", { type: "button", className: "lum-btn is-primary", onClick: saveSpec, disabled: !spec.signTypeCode || saveStatus === "saving", children: saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save Spec" }), _jsx("button", { type: "button", className: "lum-btn is-danger", onClick: clearAll, children: "Clear" })] })] }), _jsxs("div", { className: "sbp-form__scroll", children: [_jsx(SpecSummary, {}), saveStatus === "error" && !spec.signTypeCode ? (_jsx(Banner, { tone: "amber", children: "Please select a sign type first." })) : null, _jsx(Step1SignType, {}), isLetter(spec.signTypeCode || "") ? _jsx(Step1bFabrication, {}) : null, spec.signTypeCode ? _jsx(Step2Faces, {}) : null, spec.faces && !isLetter(spec.signTypeCode || "") && !isPan(spec.signTypeCode || "") ? (_jsx(Step3Dimensions, {})) : null, spec.faces ? _jsx(Step4Illumination, {}) : null, (spec.illumination === "IL" || spec.illumination === "EL") ? _jsx(Step5LED, {}) : null, spec.illumination ? _jsx(Step6FaceType, {}) : null, (spec.faceType === "RFPB" || spec.faceType === "RFPT") ? _jsx(Step6bRoutedBacker, {}) : null, spec.faceType && !spec.outsourced ? _jsx(Step7Finish, {}) : null, spec.faceType ? _jsx(Step8Vinyl, {}) : null, spec.faceType ? _jsx(Step9Mounting, {}) : null, !spec.signTypeCode ? (_jsx("div", { className: "sbp-empty", children: "Pick a sign type in step 1 to start the cascade." })) : null] })] })] }));
}
