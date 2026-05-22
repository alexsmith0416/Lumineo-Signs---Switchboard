import { useEffect, useState } from "react";
import type { Role } from "./types";
import { usersByRole } from "./data/mockData";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";

const BUILD_TAG = "V14 — explicit grid";

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

function DebugBanner({ pinnedTo }: { pinnedTo: number | null }) {
  const [dims, setDims] = useState({
    inner: 0,
    docW: 0,
    screen: 0,
    dpr: 0,
    ua: "",
  });
  useEffect(() => {
    const update = () =>
      setDims({
        inner: window.innerWidth,
        docW: document.documentElement.clientWidth,
        screen: window.screen?.width ?? 0,
        dpr: window.devicePixelRatio || 1,
        ua: navigator.userAgent.slice(0, 90),
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const kpiW =
    pinnedTo != null ? Math.floor((Math.max(pinnedTo - 20, 240) - 6) / 2) : "?";

  // Count actual rendered .kpi DOM nodes — confirms how many React rendered
  const [kpiCount, setKpiCount] = useState<number>(0);
  useEffect(() => {
    const tick = setInterval(() => {
      const n = document.querySelectorAll(".kpi-grid > .kpi").length;
      setKpiCount(n);
    }, 200);
    return () => clearInterval(tick);
  }, []);

  return (
    <div
      style={{
        background: "#E8151B",
        color: "white",
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 11,
        padding: "6px 10px",
        lineHeight: 1.35,
        wordBreak: "break-all",
        textAlign: "left",
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>BUILD {BUILD_TAG}</div>
      <div>
        innerW={dims.inner} · docW={dims.docW} · screenW={dims.screen} · dpr=
        {dims.dpr}
      </div>
      <div>
        pinned={pinnedTo ?? "?"}px · kpi-w={kpiW}px · kpi-count={kpiCount}
      </div>
      <div style={{ opacity: 0.85 }}>UA: {dims.ua}</div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const user = usersByRole[role];
  const screenW = useActualScreenWidth();
  useLayoutVars(screenW);

  // Compute exact pixel widths to pass as inline-style props down the tree.
  // CSS-variable approach didn't reach the renderer in Brave WebView; inline
  // styles always take precedence and bypass any cascade weirdness.
  const contentW = screenW ? Math.max(screenW - 20, 240) : null;
  const kpiW = contentW ? Math.floor((contentW - 6) / 2) : null;
  const tileW = contentW ? Math.floor((contentW - 12) / 2) : null;

  const pinStyle: React.CSSProperties = screenW
    ? {
        width: `${screenW}px`,
        maxWidth: `${screenW}px`,
        margin: "0 auto",
        overflowX: "hidden",
      }
    : {};

  return (
    <div className="app" style={pinStyle}>
      <DebugBanner pinnedTo={screenW} />
      <Header user={user} role={role} onChangeRole={setRole} />
      <SplashScreen role={role} kpiWidth={kpiW} tileWidth={tileW} />
      <div className="footer">
        Switchboard prototype · role-switch demo · mocked data
      </div>
    </div>
  );
}
