import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/lumineo.css";
import { applyTheme, getStoredTheme } from "./theme";

// Apply the persisted theme before first paint so there's no light→dark flash.
applyTheme(getStoredTheme());

// HTML5 drag-and-drop has no native support on iOS Safari and is flaky
// on Android Chrome. The polyfill wires touch events to the native drag
// event pipeline so all existing drag handlers continue to work on phones
// + iPads. forceApply: true also patches Chromium Android.
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";
polyfill({ forceApply: true });

// Suppress the polyfill's passive-listener warnings on scroll
window.addEventListener("touchmove", () => {}, { passive: false });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Phase-2 live-read probe. Lazily imported so the Power SDK (which calls
// getClient() at module load and needs the Power Apps runtime) is only pulled
// in when explicitly invoked under `pac code run`. Run `__probeLiveDepartments()`
// in the console to verify the live Dataverse read end-to-end.
(window as unknown as { __probeLiveDepartments?: () => void }).__probeLiveDepartments = () => {
  void import("./services/dataverse-live").then((m) => m.probeLiveDepartments());
};
