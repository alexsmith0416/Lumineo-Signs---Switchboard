import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
import { Banner } from "../../ui/Banner";
export function Step1bFabrication() {
    const { spec, setOutsourced } = useSpec();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "1B \u00B7 Fabrication" }) }), _jsx("div", { className: "sbp-step__body", children: _jsxs("div", { className: "sbp-toggle-row", children: [_jsx("button", { type: "button", className: "lum-btn is-toggle" + (!spec.outsourced ? " is-active" : ""), onClick: () => setOutsourced(false), children: "In-House" }), _jsx("button", { type: "button", className: "lum-btn is-toggle" + (spec.outsourced ? " is-active" : ""), onClick: () => setOutsourced(true), children: "Outsourced" })] }) })] }), spec.outsourced ? (_jsx(Banner, { tone: "amber", children: "Outsourced letters skip Paint & Vinyl departments in routing \u2014 finish is vendor-supplied." })) : null] }));
}
