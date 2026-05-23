import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The navy gradient summary block at the top of the form pane. Shows the
// live product code, the live department-routing string, and the COPY
// button with the 2-second confirmation.
import { useSpec } from "../app/SpecContext";
export function SpecSummary() {
    const { spec, codeCopied, copyProductCode } = useSpec();
    if (!spec.signTypeCode)
        return null;
    return (_jsxs("section", { className: "sbp-summary", "aria-label": "Spec summary", children: [_jsx("span", { className: "sbp-summary__eyebrow", children: "Live spec code" }), _jsx("span", { className: "sbp-summary__code", children: spec.productCode || "—" }), _jsxs("div", { className: "sbp-summary__row", children: [spec.customerName ? _jsxs("span", { children: [_jsx("strong", { children: "Customer:" }), "\u00A0", spec.customerName] }) : null, spec.projectName ? _jsxs("span", { children: [_jsx("strong", { children: "Project:" }), "\u00A0", spec.projectName] }) : null, _jsxs("span", { children: [_jsx("strong", { children: "Qty:" }), "\u00A0", spec.quantity] }), spec.departments ? _jsxs("span", { children: [_jsx("strong", { children: "Departments:" }), "\u00A0", spec.departments] }) : null] }), _jsx("button", { type: "button", className: "sbp-copy-btn" + (codeCopied ? " is-copied" : ""), onClick: copyProductCode, disabled: !spec.productCode, children: codeCopied ? "✓ Copied" : "Copy Code" })] }));
}
