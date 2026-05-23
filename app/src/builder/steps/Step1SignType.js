import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
import { SIGN_TYPES, INDOOR_ONLY } from "../../domain/signTypes";
import { Banner } from "../../ui/Banner";
export function Step1SignType() {
    const { spec, setSignType, update } = useSpec();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sbp-step", children: [_jsxs("div", { className: "sbp-step__head is-split", children: [_jsx("span", { children: "1 \u00B7 Sign Type" }), _jsx("span", { children: "Qty" })] }), _jsx("div", { className: "sbp-step__body", children: _jsxs("div", { className: "sbp-step__row is-split-qty", children: [_jsxs("select", { className: "lum-select", value: spec.signTypeCode, onChange: (e) => setSignType(e.target.value || ""), children: [_jsx("option", { value: "", children: "Select a sign type\u2026" }), SIGN_TYPES.map((t) => (_jsx("option", { value: t.code, children: t.name }, t.code)))] }), _jsx("input", { className: "lum-input", type: "number", min: 1, value: spec.quantity, onChange: (e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) }) })] }) })] }), spec.signTypeCode === "EP" ? (_jsx(Banner, { tone: "amber", children: "Pre-painted White or Black ONLY \u2014 no custom paint on Economy Pan Signs." })) : null, INDOOR_ONLY.includes(spec.signTypeCode) ? (_jsx(Banner, { tone: "red", children: "INDOOR USE ONLY \u2014 this sign type is not rated for outdoor installation." })) : null] }));
}
