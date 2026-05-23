import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
// H/W/D — hidden for letter types; cabinet/pan/EMC only.
export function Step3Dimensions() {
    const { spec, update } = useSpec();
    return (_jsxs("div", { className: "sbp-step", children: [_jsxs("div", { className: "sbp-step__head is-threecol", children: [_jsx("span", { children: "3 \u00B7 Height (in)" }), _jsx("span", { children: "Width (in)" }), _jsx("span", { children: "Depth (in)" })] }), _jsx("div", { className: "sbp-step__body", children: _jsxs("div", { className: "sbp-step__threecol", children: [_jsx("input", { className: "lum-input", placeholder: "H", inputMode: "decimal", value: spec.heightIn, onChange: (e) => update({ heightIn: e.target.value }) }), _jsx("input", { className: "lum-input", placeholder: "W", inputMode: "decimal", value: spec.widthIn, onChange: (e) => update({ widthIn: e.target.value }) }), _jsx("input", { className: "lum-input", placeholder: "D", inputMode: "decimal", value: spec.depthIn, onChange: (e) => update({ depthIn: e.target.value }) })] }) })] }));
}
