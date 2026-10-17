import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import Topbar from "./components/Topbar";
import SaveStatus from "./components/SaveStatus";
import Dashboard from "./screens/Dashboard";
import Builder from "./screens/Builder";
import Projects from "./screens/Projects";
import Library from "./screens/Library";
import SetupHome from "./screens/SetupHome";
import Help from "./screens/Help";
import DemoBanner from "./components/DemoBanner";
import DemoTutorial from "./components/DemoTutorial";
import { useDemoStore } from "./store/demo-store";
import { useCurrentUser } from "./services/current-user";
import { bcLink, syncAndWait } from "./services/bc-link";
import { jobFields, opportunityFields } from "./services/bc-fill";
import { useSetupStore } from "./store/setup-store";
import { useSpecStore } from "./store/spec-store";

const TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  builder: "Builder",
  projects: "Projects",
  library: "Sign Library",
  setup: "Setup",
  help: "Help",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  developer: "Developer",
  ops: "Operations",
  pm: "Project Manager",
  sales: "Sales",
  production: "Production",
  "install-wk": "Installation",
  "install-nek": "Installation",
  demo: "Demo",
};

/** Launch parameters (from Switchboard, the BC Job Card or a link):
 *  ?specId=… | ?jobId=J… | ?opportunityId=OP…
 *  In Power Apps the app runs in a frame — the play link's parameters come
 *  from the SDK (getContext().app.queryParams), not window.location. Names
 *  are matched ignoring case. */
async function launchParams(): Promise<{ specId: string; jobNo: string; opportunityNo: string }> {
  const all: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => (all[k.toLowerCase()] = v));
  try {
    const { getContext } = await import("@microsoft/power-apps/app");
    const ctx = await getContext();
    for (const [k, v] of Object.entries(ctx.app.queryParams ?? {})) if (v) all[k.toLowerCase()] = String(v);
  } catch {
    /* dev / outside Power Apps: window.location only */
  }
  const get = (k: string) => (all[k.toLowerCase()] ?? "").trim();
  return { specId: get("specId"), jobNo: get("jobId"), opportunityNo: get("opportunityId") };
}

export default function App() {
  const user = useCurrentUser();
  const [view, setView] = useState<View>("dashboard");
  const [currentSpecId, setCurrentSpecId] = useState<string>("");
  const [selectedSignId, setSelectedSignId] = useState<string>("");

  const loadSetup = useSetupStore((s) => s.load);
  const setupError = useSetupStore((s) => s.error);
  const loadSpecs = useSpecStore((s) => s.load);
  const specsLoaded = useSpecStore((s) => s.loaded);
  const specs = useSpecStore((s) => s.specs);
  const lines = useSpecStore((s) => s.lines);
  const createSpec = useSpecStore((s) => s.createSpec);
  const updateSpec = useSpecStore((s) => s.updateSpec);

  useEffect(() => {
    void loadSetup();
    void loadSpecs();
  }, [loadSetup, loadSpecs]);

  // Opened for a spec, job or opportunity: go straight to it (or start one).
  const [launched, setLaunched] = useState(false);
  useEffect(() => {
    if (launched || !specsLoaded || user.loading) return;
    setLaunched(true);
    void launchParams().then(({ specId, jobNo, opportunityNo }) => {
      if (!specId && !jobNo && !opportunityNo) return;
      const specs = useSpecStore.getState().specs;
      const found =
        specs.find((s) => s.id === specId) ??
        (jobNo ? specs.find((s) => s.jobNo === jobNo) : undefined) ??
        (opportunityNo ? specs.find((s) => s.opportunityNo === opportunityNo) : undefined);
      const spec = found ?? (user.permissions.editSpecs && (jobNo || opportunityNo) ? createSpec({ jobNo, opportunityNo }, user.fullName) : undefined);
      // A spec just started from BC: fill in the customer etc. from the opportunity / project.
      if (spec && !found) {
        const fill = async () => {
          // Not in the app's copy yet (new in BC since the last refresh): ask BC, then look again.
          let o = opportunityNo ? await bcLink().getOpportunity(opportunityNo) : null;
          if (opportunityNo && !o) {
            await syncAndWait("sbopportunities", user.fullName);
            o = await bcLink().getOpportunity(opportunityNo);
          }
          if (o) updateSpec(spec.id, opportunityFields(useSpecStore.getState().specs.find((x) => x.id === spec.id) ?? spec, o));
          const no = jobNo || o?.projectNo;
          let j = no ? await bcLink().getJob(no) : null;
          if (no && !j) {
            await syncAndWait("sbjobs", user.fullName);
            j = await bcLink().getJob(no);
          }
          if (j) updateSpec(spec.id, jobFields(useSpecStore.getState().specs.find((x) => x.id === spec.id) ?? spec, j));
        };
        void fill().catch(() => undefined);
      }
      if (spec) {
        setCurrentSpecId(spec.id);
        setView("builder");
      }
    });
  }, [launched, specsLoaded, user.loading, user.permissions.editSpecs, user.fullName, createSpec, updateSpec]);

  // Demo sandbox: Demo-type logins boot locked into it (tour offered).
  const demoMode = useDemoStore((s) => s.demoMode);
  const enterDemo = useDemoStore((s) => s.enterDemo);
  useEffect(() => {
    if (!user.loading && user.type === "demo" && !demoMode) void enterDemo({ locked: true, welcome: true });
  }, [user.loading, user.type, demoMode, enterDemo]);

  // The tour opens screens; the Builder needs a spec on screen.
  const navigate = useCallback(
    (v: string) => {
      const target = v as View;
      if (target === "builder" && !useSpecStore.getState().specs.some((s) => s.id === currentSpecId)) {
        const first = useSpecStore.getState().specs[0];
        if (first) setCurrentSpecId(first.id);
      }
      setView(target);
    },
    [currentSpecId],
  );

  const openSpec = (id: string) => {
    setCurrentSpecId(id);
    setSelectedSignId("");
    setView("builder");
  };

  const liveCode = useMemo(() => {
    if (view !== "builder") return undefined;
    return lines.find((l) => l.id === selectedSignId)?.specCode ?? "";
  }, [view, lines, selectedSignId]);

  return (
    <div className="app-shell">
      <Sidebar current={view} onSelect={setView} showSetup={user.permissions.setup} />
      <main className="app-main">
        <Topbar title={TITLES[view]} userName={user.fullName || user.email} userRole={ROLE_LABEL[user.type] ?? user.type} liveCode={liveCode} />
        <SaveStatus />
        <DemoBanner />
        <div className="app-content">
          {setupError && (
            <div className="sbp-page">
              <div className="sbp-banner sbp-banner--error">The setup couldn't be loaded: {setupError}</div>
            </div>
          )}
          {view === "dashboard" && (
            <Dashboard
              onOpenSpec={openSpec}
              onNewSpec={() => openSpec(createSpec({}, user.fullName).id)}
              onNav={setView}
              canEdit={user.permissions.editSpecs}
            />
          )}
          {view === "builder" && (
            <Builder
              user={user}
              specId={currentSpecId}
              onSelectSpec={openSpec}
              selectedSignId={selectedSignId}
              onSelectSign={setSelectedSignId}
            />
          )}
          {view === "projects" && <Projects onOpenSpec={openSpec} canEdit={user.permissions.editSpecs} />}
          {view === "library" && <Library onOpenSpec={openSpec} />}
          {view === "setup" && user.permissions.setup && <SetupHome userName={user.fullName || user.email} />}
          {view === "help" && <Help onLaunchDemo={() => void enterDemo({ locked: false, welcome: true })} />}
        </div>
      </main>
      <DemoTutorial onNavigate={navigate} />
    </div>
  );
}
