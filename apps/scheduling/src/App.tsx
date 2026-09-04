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
import HelpScreen from "./components/HelpScreen";
import DemoBanner from "./components/DemoBanner";
import SaveStatus from "./components/SaveStatus";
import DemoTutorial from "./components/DemoTutorial";
import { useDemoStore } from "./store/demo-store";
import { useLoadsStore } from "./shipping/loads-store";
import { hydrateInstallCards } from "./services/install-cards";
import { useCurrentUser } from "./services/current-user";
import { useSettingsStore } from "./store/settings-store";
import { useJobScheduleStore } from "./store/job-schedule-store";
import { useJobDeptCompletionStore } from "./store/job-dept-completion-store";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type View =
  | "my-schedule"
  | "production"
  | "installation"
  | "shipping"
  | "scenario"
  | "monthly"
  | "settings"
  | "help";

const VIEW_TITLES: Record<View, string> = {
  "my-schedule": "My Schedule",
  production: "Production Schedule",
  installation: "Installation & Service Schedule",
  shipping: "Shipping Schedule",
  scenario: "Scenario Schedule",
  monthly: "Monthly Install Plan",
  settings: "Settings",
  help: "Help & User Guide",
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
    if (view && view !== "settings" && view !== "help") lastRealViewRef.current = view;
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
  const { role, loading: userLoading, permissions, defaultView, installRegion, isImpersonating, viewingAsName, isDemoUser } =
    useCurrentUser();

  // Demo sandbox. Demo users boot LOCKED into it (welcome tour shown); anyone
  // else can launch it from Help (unlocked, can exit).
  const demoMode = useDemoStore((s) => s.demoMode);
  const enterDemo = useDemoStore((s) => s.enterDemo);
  useEffect(() => {
    if (!userLoading && isDemoUser && !demoMode) enterDemo({ locked: true, welcome: true });
  }, [userLoading, isDemoUser, demoMode, enterDemo]);
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

  // Live: load shipping loads from Dataverse once at startup.
  useEffect(() => {
    if (!LIVE) return;
    void useLoadsStore.getState().hydrate();
  }, []);

  // Install-card cache, in BOTH modes (it resolves its own source). Read by the
  // Shipping "Scheduled" badge and the Production board's mirrored rows, neither
  // of which can wait for the Installation board to be opened first.
  useEffect(() => {
    void hydrateInstallCards().catch(() => {});
  }, []);

  // Per-job schedule dates (release/target/red) — loaded once, overlaid by jobNo.
  useEffect(() => {
    void useJobScheduleStore.getState().load();
    void useJobDeptCompletionStore.getState().load();
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
        <SaveStatus />
        {!presentationMode && <ImpersonationBanner />}
        {!presentationMode && <DemoBanner />}
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
          {view === "help" && (
            <HelpScreen
              onLaunchDemo={() => {
                enterDemo({ locked: false, welcome: true });
                setView("production");
              }}
            />
          )}
        </div>
      </main>

      <DemoTutorial onNavigate={(v) => setView(v as View)} />

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
