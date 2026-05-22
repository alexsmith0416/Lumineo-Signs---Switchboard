import { useState } from "react";
import AppHeader from "./components/AppHeader";
import ProductionCalendar from "./components/ProductionCalendar";
import ScenarioSandbox from "./components/ScenarioSandbox";

type View = "production" | "installation" | "shipping" | "scenario";

const VIEW_TITLES: Record<View, string> = {
  production: "Production Scheduling",
  installation: "Installation Scheduling",
  shipping: "Shipping Scheduling",
  scenario: "Scenario Sandbox",
};

export default function App() {
  const [view, setView] = useState<View>("production");

  return (
    <div className="app-shell">
      <AppHeader title={VIEW_TITLES[view]} />

      <nav className="app-sidebar">
        <div className="app-sidebar__section-label">Schedules</div>
        <button
          className={`app-sidebar__item${view === "production" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("production")}
        >
          Production
        </button>
        <button
          className={`app-sidebar__item${view === "installation" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("installation")}
        >
          Installation
        </button>
        <button
          className={`app-sidebar__item${view === "shipping" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("shipping")}
        >
          Shipping
        </button>
        <div className="app-sidebar__divider" />
        <div className="app-sidebar__section-label">Planning</div>
        <button
          className={`app-sidebar__item${view === "scenario" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("scenario")}
        >
          Scenarios
        </button>
      </nav>

      <main className="app-main">
        {view === "production" && <ProductionCalendar />}
        {view === "installation" && (
          <div className="empty-state">
            <h2>Installation Schedule</h2>
            <p>Stub view — M6 turns this into a live crews/installs calendar.</p>
          </div>
        )}
        {view === "shipping" && (
          <div className="empty-state">
            <h2>Shipping Schedule</h2>
            <p>Stub view — M7 brings drivers, trucks, and destinations.</p>
          </div>
        )}
        {view === "scenario" && <ScenarioSandbox />}
      </main>
    </div>
  );
}
