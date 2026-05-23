import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
export function Step4Illumination() {
    const { spec, setIllumination } = useSpec();
    // EMC: forced internal. Pan types: forced non-illuminated.
    const t = spec.signTypeCode;
    const options = (() => {
        if (t === "EM")
            return [{ value: "IL", label: "Internally Illuminated" }];
        if (t === "AP" || t === "EP" || t === "PP")
            return [{ value: "NI", label: "Non-Illuminated" }];
        return [
            { value: "IL", label: "Internally Illuminated" },
            { value: "EL", label: "Externally Illuminated" },
            { value: "NI", label: "Non-Illuminated" },
        ];
    })();
    const locked = options.length === 1;
    return (_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "4 \u00B7 Illumination" }) }), _jsx("div", { className: "sbp-step__body", children: _jsxs("select", { className: "lum-select", value: spec.illumination, onChange: (e) => setIllumination((e.target.value || "")), disabled: locked, children: [!locked ? _jsx("option", { value: "", children: "Select\u2026" }) : null, options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }) })] }));
}
