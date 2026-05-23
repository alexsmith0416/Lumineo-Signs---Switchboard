import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Route, Routes } from "react-router-dom";
import { Header } from "../ui/Header";
import { Dashboard } from "../screens/Dashboard";
import { Builder } from "../screens/Builder";
import { Gallery } from "../screens/Gallery";
import { Reports } from "../screens/Reports";
import { SpecProvider, useSpec } from "./SpecContext";
import { useLaunchParams } from "./launchParams";
export default function App() {
    return (_jsx(SpecProvider, { children: _jsx(Shell, {}) }));
}
function Shell() {
    const launch = useLaunchParams();
    const { spec } = useSpec();
    return (_jsxs("div", { className: "lum-app", children: [_jsx(Header, { launch: launch, productCode: spec.productCode }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "/builder", element: _jsx(Builder, {}) }), _jsx(Route, { path: "/gallery", element: _jsx(Gallery, {}) }), _jsx(Route, { path: "/reports", element: _jsx(Reports, {}) })] })] }));
}
