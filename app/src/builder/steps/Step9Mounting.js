import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
import { isLetter } from "../../domain/signTypes";
function getOptions(signType) {
    if (signType === "WC") {
        return [
            { value: "FM", label: "Flush Mount" },
            { value: "WB", label: "Wall / Roof Bracket" },
            { value: "FB", label: "Flag-Mount Bracket" },
        ];
    }
    if (isLetter(signType)) {
        return [
            { value: "DM", label: "Direct Mount" },
            { value: "RW", label: "Raceway" },
            { value: "RB", label: "Reverse Backer Plate" },
        ];
    }
    if (signType === "MN") {
        return [
            { value: "FM", label: "Footing Mount" },
            { value: "RM", label: "Recessed Mount" },
        ];
    }
    // PS, PP, AP, EP, EM — general cabinet mounting set.
    return [
        { value: "FM", label: "Footing Mount" },
        { value: "DM", label: "Direct Mount" },
        { value: "RM", label: "Recessed Mount" },
    ];
}
export function Step9Mounting() {
    const { spec, update } = useSpec();
    const options = getOptions(spec.signTypeCode || "");
    return (_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "9 \u00B7 Mounting" }) }), _jsx("div", { className: "sbp-step__body", children: _jsxs("select", { className: "lum-select", value: spec.mounting, onChange: (e) => update({ mounting: (e.target.value || "") }), children: [_jsx("option", { value: "", children: "Select\u2026" }), options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }) })] }));
}
