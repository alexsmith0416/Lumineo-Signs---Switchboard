import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
const BACKER_TYPES = [
    { value: "FP", label: "Flat Plex .177in White Acrylic" },
    { value: "PT", label: "Push-Through .5in Clear Acrylic" },
    { value: "CU", label: "Custom" },
];
const BACKER_COLORS = [
    "White Acrylic",
    "Clear Acrylic",
    "Matte Clear",
    "70% White Diffuser Film",
    "Custom",
];
export function Step6bRoutedBacker() {
    const { spec, update } = useSpec();
    return (_jsxs("div", { className: "sbp-step", children: [_jsxs("div", { className: "sbp-step__head is-twocol", children: [_jsx("span", { children: "Backer Material" }), _jsx("span", { children: "Backer Tint / Diffuser" })] }), _jsx("div", { className: "sbp-step__body", children: _jsxs("div", { className: "sbp-step__twocol", children: [_jsxs("select", { className: "lum-select", value: spec.backerType, onChange: (e) => update({ backerType: (e.target.value || "") }), children: [_jsx("option", { value: "", children: "Select\u2026" }), BACKER_TYPES.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }), _jsxs("select", { className: "lum-select", value: spec.backerColor, onChange: (e) => update({ backerColor: e.target.value }), children: [_jsx("option", { value: "", children: "Select\u2026" }), BACKER_COLORS.map((o) => (_jsx("option", { value: o, children: o }, o)))] })] }) }), _jsx("div", { className: "sbp-step__notes", children: "Standard: min 2\" letter height \u2014 \u00BC\" stroke (std) / \u215C\" (push-thru) \u2014 serif fonts not recommended at minimums \u2014 allow 3.25\" from cabinet edge." })] }));
}
