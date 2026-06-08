import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app/App";
import "./ui/lumineo-ui.css";
import "./app/app.css";
import { seedIfEmpty } from "./data/seed";

// Apply the theme as early as possible so there's no light-mode flash on
// dark-mode first paint. Mirror of useTheme's detection.
(function bootstrapTheme() {
  try {
    const stored = localStorage.getItem("signbuilderpro.theme");
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch { /* private mode etc. — default theme kicks in via CSS */ }
})();

seedIfEmpty();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
