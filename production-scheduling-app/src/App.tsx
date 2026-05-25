import { useState } from "react";
import AppHeader from "./components/AppHeader";
import NavDrawer from "./components/NavDrawer";
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

const NAV_ITEMS = [
  { id: "production", label: "Production", group: "Schedules" },
  { id: "installation", label: "Installation", group: "Schedules" },
  { id: "shipping", label: "Shipping", group: "Schedules" },
  { id: "monthly", label: "Monthly Plan", group: "Planning" },
  { id: "scenario", label: "Scenarios", group: "Planning" },
];

export default function App() {
  const [view, setView] = useState<View>("production");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <AppHeader title={VIEW_TITLES[view]} onMenu={() => setDrawerOpen(true)} />

      <NavDrawer
        open={drawerOpen}
        current={view}
        items={NAV_ITEMS}
        onSelect={(id) => setView(id as View)}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="app-main">
        {view === "production" && (
          <ProductionCalendar onNavigate={(v) => setView(v as View)} />
        )}
        {view === "installation" && (
          <InstallationCalendar onNavigate={(v) => setView(v as View)} />
        )}
        {view === "shipping" && (
          <ShippingCalendar onNavigate={(v) => setView(v as View)} />
        )}
        {view === "scenario" && <ScenarioSandbox />}
        {view === "monthly" && <MonthlyPlanView />}
      </main>
    </div>
  );
}
