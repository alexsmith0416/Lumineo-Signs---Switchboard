import { jsx as _jsx } from "react/jsx-runtime";
export function Pill({ tone = "default", children }) {
    const cls = tone === "default" ? "lum-pill" : `lum-pill is-${tone}`;
    return _jsx("span", { className: cls, children: children });
}
