import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
const NAV_ITEMS = [
    { to: "/", label: "Dashboard" },
    { to: "/builder", label: "Builder" },
    { to: "/gallery", label: "Gallery" },
    { to: "/reports", label: "Reports" },
];
export function Header({ launch, productCode }) {
    const initials = (launch.userEmail || "U")
        .split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join("");
    return (_jsxs("header", { className: "lum-header", children: [_jsxs("div", { className: "lum-header__brand", children: [_jsx("div", { className: "lum-header__logo", children: "L" }), _jsxs("div", { className: "lum-header__brand-text", children: [_jsx("span", { className: "lum-header__brand-name", children: "LUMINEO SIGNS" }), _jsx("span", { className: "lum-header__brand-sub", children: "Sign Builder Pro" })] })] }), _jsx("nav", { className: "lum-header__nav", "aria-label": "Primary", children: NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, end: item.to === "/", className: ({ isActive }) => "lum-header__navlink" + (isActive ? " is-active" : ""), children: item.label }, item.to))) }), _jsxs("div", { className: "lum-header__right", children: [productCode ? (_jsx("span", { className: "lum-header__spec-badge", title: "Live product code", children: productCode })) : null, _jsx("div", { className: "lum-header__avatar", "aria-hidden": true, children: initials || "U" }), _jsxs("div", { className: "lum-header__userblock", children: [_jsx("span", { className: "lum-header__username", children: launch.userEmail || "Unknown user" }), _jsx("span", { className: "lum-header__userrole", children: launch.role || "Guest" })] })] })] }));
}
