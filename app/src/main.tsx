import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app/App";
import "./ui/lumineo-ui.css";
import "./app/app.css";
import { seedIfEmpty } from "./data/seed";

// Power Apps hosts the bundle from a path that's not the root, so HashRouter
// keeps SPA routing portable across local dev and the hosted runtime.
seedIfEmpty();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
