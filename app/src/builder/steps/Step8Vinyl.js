import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { useSpec } from "../../app/SpecContext";
import { VINYL_3630, VINYL_7725, matchesVinylSearch, swatchDisplayName, } from "../../domain/vinylSwatches";
const TYPES = [
    { value: "CV", label: "Cut Vinyl" },
    { value: "DV", label: "Digital Print" },
    { value: "FX", label: "Vehicle / Wrap Film" },
    { value: "NV", label: "No Vinyl" },
];
export function Step8Vinyl() {
    const { spec, setVinyl, setVinylSwatch, update } = useSpec();
    const [search, setSearch] = useState("");
    // Translucent swatches when lighted, opaque otherwise.
    const swatches = useMemo(() => {
        if (spec.vinyl !== "CV")
            return [];
        const lighted = spec.illumination === "IL" || spec.illumination === "EL";
        const base = lighted ? VINYL_3630 : VINYL_7725;
        return base.filter((s) => matchesVinylSearch(s, search));
    }, [spec.vinyl, spec.illumination, search]);
    return (_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "8 \u00B7 Vinyl / Graphics" }) }), _jsxs("div", { className: "sbp-step__body", children: [_jsxs("select", { className: "lum-select", value: spec.vinyl, onChange: (e) => setVinyl((e.target.value || "")), children: [_jsx("option", { value: "", children: "Select\u2026" }), TYPES.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }), spec.vinyl === "CV" ? (_jsxs("div", { style: { marginTop: 14 }, children: [_jsxs("div", { className: "sbp-vinyl-search", children: [_jsx("input", { type: "search", className: "lum-input sbp-vinyl-search__input", placeholder: `Search ${spec.illumination === "NI" ? "3M 7725 Opaque" : "3M 3630 Translucent"} colors…`, value: search, onChange: (e) => setSearch(e.target.value) }), search ? (_jsx("button", { type: "button", className: "sbp-vinyl-search__clear", "aria-label": "Clear search", onClick: () => setSearch(""), children: "\u00D7" })) : null] }), _jsxs("div", { className: "sbp-vinyl-grid", children: [swatches.map((s) => {
                                        const display = swatchDisplayName(s);
                                        const active = spec.vinylColor === display;
                                        return (_jsxs("button", { type: "button", className: "sbp-swatch" + (active ? " is-active" : ""), onClick: () => setVinylSwatch(display, s.hex), title: display, children: [_jsx("div", { className: "sbp-swatch__color", style: { background: s.hex } }), _jsxs("div", { className: "sbp-swatch__label", children: [_jsxs("span", { className: "sbp-swatch__series", children: ["3M ", s.series] }), _jsxs("span", { className: "sbp-swatch__name", children: [s.code, " ", s.name] })] })] }, `${s.series}-${s.code}`));
                                    }), swatches.length === 0 && search ? (_jsx("div", { className: "sbp-swatch", style: { gridColumn: "1 / -1", padding: 14, justifyContent: "center" }, children: _jsxs("span", { className: "sbp-swatch__name", style: { textAlign: "center" }, children: ["No swatch matches \"", search, "\"."] }) })) : null] }), spec.vinylColor ? (_jsxs("div", { className: "sbp-vinyl-preview", "aria-live": "polite", children: [_jsx("div", { className: "sbp-vinyl-preview__swatch", style: { background: spec.vinylHex } }), _jsxs("div", { className: "sbp-vinyl-preview__label", children: [_jsx("span", { className: "sbp-vinyl-preview__name", children: spec.vinylColor }), _jsx("span", { className: "sbp-vinyl-preview__hex", children: spec.vinylHex })] })] })) : null] })) : null, spec.vinyl === "DV" ? (_jsxs("div", { style: { marginTop: 14 }, children: [_jsx("span", { className: "lum-field-label", children: "Digital Print Reference" }), _jsx("input", { className: "lum-input", placeholder: "Art file name or SharePoint link\u2026", value: spec.digitalRef, onChange: (e) => update({ digitalRef: e.target.value }) })] })) : null] })] }));
}
