import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/lumineo.css";
import { ensureAuthenticated } from "./services/auth";

// HTML5 drag-and-drop has no native support on iOS Safari and is flaky
// on Android Chrome. The polyfill wires touch events to the native drag
// event pipeline so all existing drag handlers continue to work on phones
// + iPads. forceApply: true also patches Chromium Android.
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";
polyfill({ forceApply: true });

// Suppress the polyfill's passive-listener warnings on scroll
window.addEventListener("touchmove", () => {}, { passive: false });

// Resolve Entra context before first render so data sources can read the
// user + access token from services/auth.ts without any render-time race.
// In skeleton mode this returns immediately with null; once AUTH_CONFIG is
// filled in (M2) it awaits the Power Code App host's getCurrentUser().
ensureAuthenticated().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
