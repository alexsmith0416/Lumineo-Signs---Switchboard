import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DashboardCustomizable from "./components/DashboardCustomizable";
import "./styles.css";

/**
 * Standalone shell — boots straight into the dashboard mockup as the
 * Operations role. No splash, no role picker, no back affordance —
 * matches the Figma "Dashboard" frames pixel for pixel.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardCustomizable role="Operations" />
  </StrictMode>,
);
