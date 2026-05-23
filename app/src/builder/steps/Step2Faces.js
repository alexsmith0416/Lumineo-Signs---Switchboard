import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
import { isLetter, isPan } from "../../domain/signTypes";
export function Step2Faces() {
    const { spec, update } = useSpec();
    // Letter types locked to N/A; pan types locked to Single Face.
    const options = (() => {
        if (isLetter(spec.signTypeCode || ""))
            return [{ value: "NA", label: "N/A" }];
        if (isPan(spec.signTypeCode || ""))
            return [{ value: "SF", label: "Single Face" }];
        return [
            { value: "SF", label: "Single Face" },
            { value: "DF", label: "Double Face" },
        ];
    })();
    const locked = options.length === 1;
    return (_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "2 \u00B7 Faces / Sides" }) }), _jsx("div", { className: "sbp-step__body", children: _jsxs("select", { className: "lum-select", value: spec.faces, onChange: (e) => update({ faces: e.target.value }), disabled: locked, children: [!locked ? _jsx("option", { value: "", children: "Select\u2026" }) : null, options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }) })] }));
}
