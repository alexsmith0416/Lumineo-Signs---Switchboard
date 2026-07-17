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
import SettingsScreen from "./components/SettingsScreen";
import { useLoadsStore } from "./shipping/loads-store";
import { hydrateInstallCardCache } from "./services/dataverse-live";
import { useCurrentUser } from "./services/current-user";
import { useSettingsStore } from "./store/settings-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type View =
  | "my-schedule"
  | "production"
  | "installation"
  | "shipping"
  | "scenario"
  | "monthly"
  | "settings";

const VIEW_TITLES: Record<View, string> = {
  "my-schedule": "My Schedule",
  production: "Production Schedule",
  installation: "Installation & Service Schedule",
  shipping: "Shipping Schedule",
  scenario: "Scenario Schedule",
  monthly: "Monthly Install Plan",
  settings: "Settings",
};

export default function App() {
  const [view, setView] = useState<View | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Presentation ("TV") mode: hide the app chrome and show the current screen
  // full-bleed. Exits on ESC.
  const presentationMode = useSettingsStore((s) => s.presentationMode);
  const setPresentationMode = useSettingsStore((s) => s.setPresentationMode);

  // The toggle lives on the Settings screen, so remember the last real screen
  // (a calendar/board/plan) to show full-bleed instead of Settings itself.
  const lastRealViewRef = useRef<View>("production");
  useEffect(() => {
    if (view && view !== "settings") lastRealViewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (!presentationMode) return;
    // Don't show Settings full-bleed — jump to the last real screen instead.
    setView((v) => (v === "settings" ? lastRealViewRef.current : v));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresentationMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presentationMode, setPresentationMode]);

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

  // Only Admin/Ops may edit the schedules; everyone else gets view-only boards.
  const canEdit = permissions.editSchedule;

  if (view === null) {
    return (
      <div className="app-shell">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className={"app-shell" + (presentationMode ? " app-shell--presentation" : "")}>
      {!presentationMode && (
        <Sidebar
          current={view}
          onSelect={(id) => setView(id as View)}
          myScheduleLabel={myScheduleLabel}
          showMonthly={permissions.monthly}
          showScenario={permissions.scenarios}
        />
      )}

      <main className="app-main">
        <Topbar
          title={view === "my-schedule" ? myScheduleLabel : VIEW_TITLES[view]}
          onMenu={() => setDrawerOpen(true)}
          minimal={presentationMode}
        />
        {!presentationMode && <ImpersonationBanner />}
        <div className="app-content">
          {view === "my-schedule" && <MyScheduleScreen />}
          {view === "production" && (
            <ProductionCalendar
              readOnly={!canEdit}
              canSeeMoney={permissions.money}
              onNavigate={(v) => setView(v as View)}
            />
          )}
          {view === "installation" && (
            <InstallationCalendar
              readOnly={!canEdit}
              canSeeMoney={permissions.money}
              canSeeCrew={permissions.crew}
              initialRegion={installRegion}
              onNavigate={(v) => setView(v as View)}
            />
          )}
          {view === "shipping" && <ShippingBoard readOnly={!canEdit} />}
          {view === "scenario" && permissions.scenarios && <ScenarioSandbox />}
          {view === "monthly" && permissions.monthly && <MonthlyPlanView />}
          {view === "settings" && <SettingsScreen />}
        </div>
      </main>

      {presentationMode && (
        <button
          type="button"
          className="presentation-exit"
          aria-label="Exit full screen"
          title="Exit full screen (ESC)"
          onClick={() => setPresentationMode(false)}
        >
          ✕ Exit full screen
        </button>
      )}

      <NavDrawer
        open={drawerOpen}
        current={view}
        onSelect={(id) => setView(id as View)}
        onClose={() => setDrawerOpen(false)}
        myScheduleLabel={myScheduleLabel}
        showMonthly={permissions.monthly}
        showScenario={permissions.scenarios}
      />
    </div>
  );
}
