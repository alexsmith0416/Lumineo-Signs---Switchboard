import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SubNav from "./components/SubNav";
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

// The Project Scheduler's own views — shown as the sub-nav pill row (desktop)
// and inside the hamburger drawer (mobile).
const VIEW_NAV = [
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
      <Sidebar />

      <main className="app-main">
        <Topbar title={VIEW_TITLES[view]} onMenu={() => setDrawerOpen(true)} />
        <SubNav
          items={VIEW_NAV}
          current={view}
          onSelect={(id) => setView(id as View)}
        />
        <div className="app-content">
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
        </div>
      </main>

      <NavDrawer
        open={drawerOpen}
        current={view}
        items={VIEW_NAV}
        onSelect={(id) => setView(id as View)}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
