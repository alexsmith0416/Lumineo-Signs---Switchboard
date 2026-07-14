import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ImpersonationBanner from "./components/ImpersonationBanner";
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
  const [view, setView] = useState<View | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The signed-in user's type drives the landing screen, the sidebar item
  // label, and what's visible ($ values + Monthly Gameplanning = Admin/Ops).
  const { role, loading: userLoading, permissions, defaultView, installRegion, isImpersonating, viewingAsName } =
    useCurrentUser();
  const myScheduleLabel =
    role.kind === "admin"
      ? "Employee Schedules"
      : role.kind === "sales" || role.kind === "pm"
        ? "My Active Jobs"
        : "My Schedule";

  // Open on the user's default screen once their type resolves.
  useEffect(() => {
    if (!userLoading && view === null) setView(defaultView as View);
  }, [userLoading, defaultView, view]);

  // When an admin enters / switches / exits "view as user", land on that
  // identity's default screen so the preview starts where they'd start (and a
  // now-hidden screen like Monthly isn't left showing blank).
  const impId = isImpersonating ? viewingAsName ?? "?" : "__real__";
  const prevImpRef = useRef<string | null>(null);
  useEffect(() => {
    if (userLoading) return;
    if (prevImpRef.current !== null && prevImpRef.current !== impId) {
      setView(defaultView as View);
    }
    prevImpRef.current = impId;
  }, [impId, userLoading, defaultView]);

  // Live: load shipping loads + the install-card cache (for the Scheduled badge)
  // from Dataverse once at startup.
  useEffect(() => {
    if (!LIVE) return;
    void useLoadsStore.getState().hydrate();
    void hydrateInstallCardCache().catch(() => {});
  }, []);

  // Monthly Gameplanning is Admin/Ops only — hide it from both navs.
  const navItems = permissions.monthly ? VIEW_NAV : VIEW_NAV.filter((v) => v.id !== "monthly");

  if (view === null) {
    return (
      <div className="app-shell">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        current={view}
        onSelect={(id) => setView(id as View)}
        myScheduleLabel={myScheduleLabel}
        showMonthly={permissions.monthly}
      />

      <main className="app-main">
        <Topbar
          title={view === "my-schedule" ? myScheduleLabel : VIEW_TITLES[view]}
          onMenu={() => setDrawerOpen(true)}
        />
        <ImpersonationBanner />
        <div className="app-content">
          {view === "my-schedule" && <MyScheduleScreen />}
          {view === "production" && (
            <ProductionCalendar
              canSeeMoney={permissions.money}
              onNavigate={(v) => setView(v as View)}
            />
          )}
          {view === "installation" && (
            <InstallationCalendar
              canSeeMoney={permissions.money}
              initialRegion={installRegion}
              onNavigate={(v) => setView(v as View)}
            />
          )}
          {view === "shipping" && <ShippingBoard />}
          {view === "scenario" && <ScenarioSandbox />}
          {view === "monthly" && permissions.monthly && <MonthlyPlanView />}
        </div>
      </main>

      <NavDrawer
        open={drawerOpen}
        current={view}
        items={navItems}
        onSelect={(id) => setView(id as View)}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
