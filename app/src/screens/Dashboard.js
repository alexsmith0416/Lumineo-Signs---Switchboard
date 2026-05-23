import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { getSignType } from "../domain/signTypes";
export function Dashboard() {
    const navigate = useNavigate();
    const { recent, loadingRecent, clearAll, loadSpec } = useSpec();
    const stats = useMemo(() => {
        const totalSigns = recent.length;
        const projects = new Set(recent.map((s) => s.projectName).filter(Boolean)).size;
        const totalUnits = recent.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
        return { totalSigns, projects, totalUnits };
    }, [recent]);
    const projects = useMemo(() => {
        const m = new Map();
        for (const s of recent) {
            if (!s.projectName)
                continue;
            const cur = m.get(s.projectName) ?? { count: 0, units: 0, lastCode: s.productCode };
            cur.count += 1;
            cur.units += Number(s.quantity) || 0;
            m.set(s.projectName, cur);
        }
        return Array.from(m.entries()).slice(0, 5);
    }, [recent]);
    return (_jsxs("main", { className: "lum-page", children: [_jsxs("section", { className: "sbp-hero", children: [_jsx("div", { className: "sbp-hero__eyebrow", children: "Sign Builder Pro" }), _jsx("h1", { className: "sbp-hero__title", children: "Configure a commercial sign spec in minutes." }), _jsx("p", { className: "sbp-hero__subtitle", children: "Pick a sign type, step through the cascade, and the product code assembles itself. Saves write straight back to the Sign Specifications table in Dataverse." }), _jsxs("div", { className: "sbp-hero__ctas", children: [_jsx("button", { type: "button", className: "sbp-hero__cta is-red", onClick: () => { clearAll(); navigate("/builder"); }, children: "+ New Sign Spec" }), _jsx("button", { type: "button", className: "sbp-hero__cta is-outline", onClick: () => navigate("/gallery"), children: "Browse Gallery" })] })] }), _jsxs("section", { className: "sbp-kpis", children: [_jsxs("div", { className: "lum-card", children: [_jsx("div", { className: "sbp-kpi__value", children: stats.totalSigns }), _jsx("div", { className: "sbp-kpi__label", children: "Signs Built" })] }), _jsxs("div", { className: "lum-card", children: [_jsx("div", { className: "sbp-kpi__value", children: stats.projects }), _jsx("div", { className: "sbp-kpi__label", children: "Projects" })] }), _jsxs("div", { className: "lum-card", children: [_jsx("div", { className: "sbp-kpi__value", children: stats.totalUnits }), _jsx("div", { className: "sbp-kpi__label", children: "Total Units" })] })] }), _jsxs("section", { className: "sbp-twocol", children: [_jsxs("div", { className: "sbp-list", children: [_jsxs("div", { className: "sbp-list__head", children: [_jsx("span", { className: "sbp-list__title", children: "Individual Signs" }), _jsx("button", { type: "button", className: "lum-btn is-ghost", style: { padding: "4px 10px", fontSize: 11 }, onClick: () => { clearAll(); navigate("/builder"); }, children: "+ New" })] }), loadingRecent ? (_jsx("div", { className: "sbp-list__empty", children: "Loading\u2026" })) : recent.length === 0 ? (_jsx("div", { className: "sbp-list__empty", children: "No specs yet \u2014 start one from the hero." })) : (recent.slice(0, 6).map((s) => {
                                const t = getSignType(s.signTypeCode || "");
                                const lightTone = s.illumination === "IL" || s.illumination === "EL" ? "amber" : "muted";
                                const paintTone = s.finish === "P" ? "green" : "muted";
                                return (_jsxs("button", { type: "button", className: "sbp-list__row", onClick: () => { loadSpec(s); navigate("/builder"); }, children: [_jsxs("div", { className: "sbp-list__row-main", children: [_jsx("span", { className: "sbp-list__row-title", children: s.projectName || s.productCode || "Untitled" }), _jsxs("span", { className: "sbp-list__row-meta", children: [t?.name ?? "—", " \u00B7 Qty ", s.quantity] })] }), _jsxs("div", { className: "sbp-list__row-right", children: [s.finish === "P" ? _jsx(Pill, { tone: paintTone, children: "Painted" }) : null, s.illumination === "IL" || s.illumination === "EL"
                                                    ? _jsx(Pill, { tone: lightTone, children: "Lighted" })
                                                    : null, _jsx("span", { className: "sbp-list__chevron", children: "\u203A" })] })] }, s.id));
                            }))] }), _jsxs("div", { className: "sbp-list", children: [_jsx("div", { className: "sbp-list__head", children: _jsx("span", { className: "sbp-list__title", children: "Projects" }) }), projects.length === 0 ? (_jsx("div", { className: "sbp-list__empty", children: "No projects yet." })) : (projects.map(([name, info]) => (_jsxs("div", { className: "sbp-list__row", style: { cursor: "default" }, children: [_jsxs("div", { className: "sbp-list__row-main", children: [_jsx("span", { className: "sbp-list__row-title", children: name }), _jsxs("span", { className: "sbp-list__row-meta", children: [info.count, " sign", info.count === 1 ? "" : "s", " \u00B7 ", info.units, " units"] })] }), _jsx("div", { className: "sbp-list__row-right", children: _jsx(Pill, { tone: "navy", children: info.lastCode || "—" }) })] }, name))))] })] })] }));
}
