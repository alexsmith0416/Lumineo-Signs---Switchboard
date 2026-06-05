import { useEffect, useState } from "react";
import type { Role } from "./types";
import { myJobsByRole, resourcesByRole, usersByRole } from "./data/mockData";
import DashboardCustomizable from "./components/DashboardCustomizable";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";
import MyScheduleScreen from "./components/MyScheduleScreen";

type View = "splash" | "mySchedule" | "dashboardMockup";

/** Detect the actual visible screen width even when innerWidth lies. */
function useActualScreenWidth(): number | null {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      const docW = document.documentElement.clientWidth;
      const innerW = window.innerWidth;
      const screenW = window.screen?.width ?? innerW;
      const trueW =
        innerW > docW * 1.5 || innerW > screenW * 1.5
          ? Math.min(docW, screenW)
          : innerW;
      setW(trueW);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);
  return w;
}

/**
 * Set explicit pixel-width CSS variables fed by the detected screen width.
 * Avoids percentage-based widths which were misbehaving on Brave Android
 * when the layout viewport (innerWidth) differs from the visual viewport.
 */
function useLayoutVars(screenW: number | null): void {
  useEffect(() => {
    if (screenW == null) return;
    const root = document.documentElement.style;

    // Splash content area = screen - 2*splash-padding (10px each = 20px total)
    const contentW = Math.max(screenW - 20, 240);
    // 2-up KPI + 6px gap
    const kpiW = Math.floor((contentW - 6) / 2);
    // 2-up app tile + 12px gap
    const tileW = Math.floor((contentW - 12) / 2);

    root.setProperty("--app-w", `${screenW}px`);
    root.setProperty("--content-w", `${contentW}px`);
    root.setProperty("--kpi-w", `${kpiW}px`);
    root.setProperty("--tile-w", `${tileW}px`);
  }, [screenW]);
}

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const [view, setView] = useState<View>("splash");
  const user = usersByRole[role];
  const me = resourcesByRole[role];
  const myJobs = myJobsByRole[role];
  const screenW = useActualScreenWidth();
  useLayoutVars(screenW);

  // Cap the content area at a comfortable max so a 1920px+ desktop screen
  // gets centered content with generous side margins instead of stretching
  // edge-to-edge.
  const SPLASH_MAX = 1280;
  const contentW = screenW
    ? Math.min(Math.max(screenW - 20, 240), SPLASH_MAX)
    : null;
  const isDesktop = contentW != null && contentW >= 900;

  const kpiGap = 8;
  const tileGap = 8;
  const widgetGap = 12;

  const kpiCols = contentW ? (contentW >= 560 ? 4 : 2) : 2;
  const tileCols = contentW ? (contentW >= 560 ? 5 : 2) : 2;
  const roleGridCols = isDesktop ? 2 : 1;

  const kpiW = contentW
    ? Math.floor((contentW - kpiGap * (kpiCols - 1)) / kpiCols)
    : null;
  const tileW = contentW
    ? Math.floor((contentW - tileGap * (tileCols - 1)) / tileCols)
    : null;
  const widgetW = contentW
    ? Math.floor((contentW - widgetGap * (roleGridCols - 1)) / roleGridCols)
    : null;

  const pinStyle: React.CSSProperties = screenW
    ? {
        width: `${screenW}px`,
        maxWidth: `${screenW}px`,
        margin: "0 auto",
        overflowX: "hidden",
      }
    : {};

  if (view === "dashboardMockup") {
    return <DashboardCustomizable role={role} onBack={() => setView("splash")} />;
  }

  return (
    <div className="app" style={pinStyle}>
      <Header
        user={user}
        role={role}
        onChangeRole={(r) => {
          setRole(r);
          setView("splash");
        }}
      />
      <div className="app__viewbar">
        <button
          type="button"
          className="app__viewbtn"
          onClick={() => setView("dashboardMockup")}
        >
          View Dashboard Mockup →
        </button>
      </div>
      {view === "splash" ? (
        <SplashScreen
          role={role}
          kpiWidth={kpiW}
          kpiCols={kpiCols}
          tileWidth={tileW}
          tileCols={tileCols}
          widgetWidth={widgetW}
          widgetCols={roleGridCols}
          contentW={contentW}
          onOpenMySchedule={() => setView("mySchedule")}
        />
      ) : (
        <MyScheduleScreen
          me={me}
          jobs={myJobs}
          contentW={contentW}
          onBack={() => setView("splash")}
        />
      )}
      <div className="footer">
        Switchboard prototype · role-switch demo · mocked data
      </div>
    </div>
  );
}
