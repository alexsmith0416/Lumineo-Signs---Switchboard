import { useState } from "react";
import AppHeader from "./components/AppHeader";
import ProductionCalendar from "./components/ProductionCalendar";
import InstallationCalendar from "./components/InstallationCalendar";
import ShippingCalendar from "./components/ShippingCalendar";
import ScenarioSandbox from "./components/ScenarioSandbox";
import MonthlyPlanView from "./components/MonthlyPlanView";

type View = "production" | "installation" | "shipping" | "scenario" | "monthly";

const VIEW_TITLES: Record<View, string> = {
  production: "Production Scheduling",
  installation: "Installation Scheduling",
  shipping: "Shipping Scheduling",
  scenario: "Scenario Sandbox",
  monthly: "Monthly Install Plan",
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
          className={`app-sidebar__item${view === "monthly" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("monthly")}
        >
          Monthly Plan
        </button>
        <button
          className={`app-sidebar__item${view === "scenario" ? " app-sidebar__item--active" : ""}`}
          onClick={() => setView("scenario")}
        >
          Scenarios
        </button>
      </nav>

      <main className="app-main">
        {view === "production" && <ProductionCalendar />}
        {view === "installation" && <InstallationCalendar />}
        {view === "shipping" && <ShippingCalendar />}
        {view === "scenario" && <ScenarioSandbox />}
        {view === "monthly" && <MonthlyPlanView />}
      </main>
    </div>
  );
}
