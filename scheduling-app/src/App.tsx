import { useState } from "react";
import AppTopbar from "./components/AppTopbar";
import SwitchboardSidebar from "./components/SwitchboardSidebar";
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
      <SwitchboardSidebar />

      <NavDrawer
        open={drawerOpen}
        current={view}
        items={NAV_ITEMS}
        onSelect={(id) => setView(id as View)}
        onClose={() => setDrawerOpen(false)}
      />

      <main className="app-main">
        <AppTopbar title={VIEW_TITLES[view]} onMenu={() => setDrawerOpen(true)} />
        <SubNav view={view} onChange={setView} />
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
    </div>
  );
}

const SUB_TABS: Array<{ id: View; label: string }> = [
  { id: "production", label: "Production" },
  { id: "installation", label: "Installation" },
  { id: "shipping", label: "Shipping" },
  { id: "monthly", label: "Monthly Plan" },
  { id: "scenario", label: "Scenarios" },
];

function SubNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="sub-nav" role="tablist" aria-label="Project Scheduler views">
      {SUB_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={view === t.id}
          className={`sub-nav__tab${view === t.id ? " sub-nav__tab--active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
