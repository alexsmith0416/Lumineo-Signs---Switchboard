import { jsx as _jsx } from "react/jsx-runtime";
export function Banner({ tone, children }) {
    return (_jsx("div", { className: `lum-banner is-${tone}`, role: tone === "red" ? "alert" : "status", children: children }));
}
