import { useEffect, useState } from "react";
import type { Role } from "./types";
import { usersByRole } from "./data/mockData";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";

const BUILD_TAG = "V5 — 2026-05-22 19:00";

function DebugBanner() {
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
        {dims.dpr}
      </div>
      <div style={{ opacity: 0.85 }}>UA: {dims.ua}</div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const user = usersByRole[role];

  return (
    <div className="app">
      <DebugBanner />
      <Header user={user} role={role} onChangeRole={setRole} />
      <SplashScreen role={role} />
      <div className="footer">
        Switchboard prototype · role-switch demo · mocked data
      </div>
    </div>
  );
}
