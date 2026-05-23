import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
function getOptions(signTypeCode) {
    if (signTypeCode === "EP") {
        return [
            { value: "OEM", label: "Pre-Painted White" },
            { value: "OEM", label: "Pre-Painted Black" },
        ];
    }
    return [
        { value: "P", label: "Shop Painted" },
        { value: "RWB", label: "Raw / Mill Aluminum — Brushed" },
        { value: "RWM", label: "Raw / Mill Aluminum — Mill" },
        { value: "OEM", label: "OEM Pre-Finished" },
    ];
}
export function Step7Finish() {
    const { spec, update } = useSpec();
    const options = getOptions(spec.signTypeCode || "");
    return (_jsxs("div", { className: "sbp-step", children: [_jsxs("div", { className: "sbp-step__head is-twocol", children: [_jsx("span", { children: "7 \u00B7 Paint / Finish" }), _jsx("span", { children: spec.finish === "P" ? "Paint Color / Pantone Ref" : "(Paint color hidden)" })] }), _jsx("div", { className: "sbp-step__body", children: _jsxs("div", { className: "sbp-step__twocol", children: [_jsxs("select", { className: "lum-select", value: spec.finish, onChange: (e) => update({ finish: (e.target.value || ""), paintColor: e.target.value === "P" ? spec.paintColor : "" }), children: [_jsx("option", { value: "", children: "Select\u2026" }), options.map((o, i) => (_jsx("option", { value: o.value, children: o.label }, `${o.value}-${i}`)))] }), _jsx("input", { className: "lum-input", placeholder: "e.g. PMS 286 C Navy", value: spec.paintColor, onChange: (e) => update({ paintColor: e.target.value }), disabled: spec.finish !== "P" })] }) })] }));
}
