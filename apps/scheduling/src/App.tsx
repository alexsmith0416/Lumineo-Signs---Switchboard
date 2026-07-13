import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import NavDrawer from "./components/NavDrawer";
import ProductionCalendar from "./components/ProductionCalendar";
import InstallationCalendar from "./components/InstallationCalendar";
import ShippingBoard from "./components/ShippingBoard";
import ScenarioSandbox from "./components/ScenarioSandbox";
import MonthlyPlanView from "./components/MonthlyPlanView";
import MyScheduleScreen from "./components/MyScheduleScreen";
import { useLoadsStore } from "./shipping/loads-store";
import { hydrateInstallCardCache } from "./services/dataverse-live";
import { useCurrentUser } from "./services/current-user";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type View = "my-schedule" | "production" | "installation" | "shipping" | "scenario" | "monthly";

const VIEW_TITLES: Record<View, string> = {
  "my-schedule": "My Schedule",
  production: "Production Schedule",
  installation: "Installation & Service Schedule",
  shipping: "Shipping Schedule",
  scenario: "Scenario Schedule",
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

  // Admin/ops browse every roster ("Employee Schedules"); shared floor logins
  // see their own ("My Schedule"). Drives the sidebar item + topbar title.
  const { role } = useCurrentUser();
  const myScheduleLabel =
    role.kind === "admin"
      ? "Employee Schedules"
      : role.kind === "sales" || role.kind === "pm"
        ? "My Active Jobs"
        : "My Schedule";

  // Live: load shipping loads + the install-card cache (for the Scheduled badge)
  // from Dataverse once at startup.
  useEffect(() => {
    if (!LIVE) return;
    void useLoadsStore.getState().hydrate();
    void hydrateInstallCardCache().catch(() => {});
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        current={view}
        onSelect={(id) => setView(id as View)}
        myScheduleLabel={myScheduleLabel}
      />

      <main className="app-main">
        <Topbar
          title={view === "my-schedule" ? myScheduleLabel : VIEW_TITLES[view]}
          onMenu={() => setDrawerOpen(true)}
        />
        <div className="app-content">
          {view === "my-schedule" && <MyScheduleScreen />}
          {view === "production" && (
            <ProductionCalendar onNavigate={(v) => setView(v as View)} />
          )}
          {view === "installation" && (
            <InstallationCalendar onNavigate={(v) => setView(v as View)} />
          )}
          {view === "shipping" && <ShippingBoard />}
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
