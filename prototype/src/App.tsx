import { useEffect, useState } from "react";
import type { Role } from "./types";
import { usersByRole } from "./data/mockData";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";

const BUILD_TAG = "V7 — JS width pin";

/**
 * Some Android contexts (e.g. Brave opening content:// URLs) ignore the
 * viewport meta tag and render the page at a default desktop CSS width
 * (e.g. 1311px) while the visible screen is much narrower. CSS media
 * queries match against the layout viewport, so they "work" — but the
 * actual rendered layout overflows the screen.
 *
 * Detect the mismatch and force the app's root container to the visible
 * screen width. CSS percentages inside then refer to the constrained
 * width rather than the inflated layout viewport.
 */
function useActualScreenWidth(): number | null {
  const [w, setW] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      const docW = document.documentElement.clientWidth;
      const innerW = window.innerWidth;
      const screenW = window.screen?.width ?? innerW;
      // If JS innerWidth is way wider than the document/screen width, use
      // the smaller. Otherwise use innerWidth (the normal case).
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
        {dims.dpr} · pinned={pinnedTo ?? "?"}px
      </div>
      <div style={{ opacity: 0.85 }}>UA: {dims.ua}</div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const user = usersByRole[role];
  const screenW = useActualScreenWidth();

  // Pin the entire app to the detected screen width so layout can't extend
  // beyond the visible viewport even when the browser misreports innerWidth.
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
      <SplashScreen role={role} />
      <div className="footer">
        Switchboard prototype · role-switch demo · mocked data
      </div>
    </div>
  );
}
