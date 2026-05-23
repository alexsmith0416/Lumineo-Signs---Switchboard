import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
import { Banner } from "../../ui/Banner";
const COLORS = [
    { code: "WH", label: "White 7100K", dot: "#F5F5F5" },
    { code: "RD", label: "Red", dot: "#E8151B" },
    { code: "BL", label: "Blue", dot: "#0074C8" },
    { code: "GR", label: "Green", dot: "#1A7A4A" },
    { code: "RGB", label: "RGB", dot: "linear-gradient(90deg,#E8151B,#F4B400,#1A7A4A,#0074C8,#5C3478)" },
];
export function Step5LED() {
    const { spec, update } = useSpec();
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "5 \u00B7 LED Color" }) }), _jsx("div", { className: "sbp-step__body", children: _jsx("div", { className: "sbp-toggle-row", children: COLORS.map((c) => (_jsxs("button", { type: "button", className: "lum-btn is-toggle" + (spec.ledColor === c.code ? " is-active" : ""), onClick: () => update({ ledColor: c.code }), children: [_jsx("span", { "aria-hidden": true, style: {
                                            display: "inline-block",
                                            width: 10,
                                            height: 10,
                                            borderRadius: 999,
                                            background: c.dot,
                                            border: "1px solid rgba(0,0,0,0.15)",
                                        } }), c.label] }, c.code))) }) })] }), spec.ledColor === "RGB" ? (_jsx(Banner, { tone: "amber", children: "RGB requires programmable driver + controller \u2014 confirm price uplift with Sales before quoting." })) : null] }));
}
