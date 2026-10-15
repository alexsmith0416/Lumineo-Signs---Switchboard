import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/lumineo.css";
import "./styles/signbuilder.css";
import { applyTheme, getStoredTheme } from "./theme";

// Apply the persisted theme before first paint so there's no light→dark flash.
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
