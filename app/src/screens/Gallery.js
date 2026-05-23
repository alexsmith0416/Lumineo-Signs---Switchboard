import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { SIGN_TYPES, getSignType } from "../domain/signTypes";
export function Gallery() {
    const navigate = useNavigate();
    const { recent, loadSpec } = useSpec();
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const filtered = recent.filter((s) => {
        if (typeFilter && s.signTypeCode !== typeFilter)
            return false;
        if (!query.trim())
            return true;
        const q = query.trim().toLowerCase();
        return [s.customerName, s.projectName, s.productCode]
            .filter(Boolean)
            .some((v) => v.toLowerCase().includes(q));
    });
    return (_jsxs("main", { className: "lum-page", children: [_jsxs("div", { children: [_jsx("div", { className: "lum-section-label", children: "Gallery" }), _jsx("h2", { style: { margin: 0, fontSize: 22, color: "var(--lum-navy)" }, children: "All saved specs" })] }), _jsxs("div", { className: "lum-card", style: { display: "flex", gap: 12, alignItems: "center" }, children: [_jsx("input", { type: "search", className: "lum-input", placeholder: "Search by customer, project, or code\u2026", value: query, onChange: (e) => setQuery(e.target.value), style: { flex: 2 } }), _jsxs("select", { className: "lum-select", value: typeFilter, onChange: (e) => setTypeFilter(e.target.value), style: { flex: 1 }, children: [_jsx("option", { value: "", children: "All sign types" }), SIGN_TYPES.map((t) => (_jsx("option", { value: t.code, children: t.name }, t.code)))] })] }), _jsxs("div", { className: "sbp-list", children: [_jsx("div", { className: "sbp-list__head", children: _jsxs("span", { className: "sbp-list__title", children: [filtered.length, " spec", filtered.length === 1 ? "" : "s"] }) }), filtered.length === 0 ? (_jsx("div", { className: "sbp-list__empty", children: "No specs match that filter." })) : (filtered.map((s) => {
                        const t = getSignType(s.signTypeCode || "");
                        return (_jsxs("button", { type: "button", className: "sbp-list__row", onClick: () => { loadSpec(s); navigate("/builder"); }, children: [_jsxs("div", { className: "sbp-list__row-main", children: [_jsx("span", { className: "sbp-list__row-title", children: s.projectName || s.productCode || "Untitled" }), _jsxs("span", { className: "sbp-list__row-meta", children: [s.customerName ? `${s.customerName} · ` : "", t?.name ?? "—", " \u00B7 Qty ", s.quantity] })] }), _jsxs("div", { className: "sbp-list__row-right", children: [_jsx(Pill, { tone: "navy", children: s.productCode || "—" }), _jsx("span", { className: "sbp-list__chevron", children: "\u203A" })] })] }, s.id));
                    }))] })] }));
}
