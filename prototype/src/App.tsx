import { useEffect, useState } from "react";
import type { Role } from "./types";
import { usersByRole } from "./data/mockData";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";

function DebugOverlay() {
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
        ua: navigator.userAgent.slice(0, 60),
      });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#000",
        color: "#0f0",
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 11,
        padding: "6px 10px",
        zIndex: 9999,
        lineHeight: 1.3,
        wordBreak: "break-all",
      }}
    >
      innerW={dims.inner} · docW={dims.docW} · screenW={dims.screen} · dpr=
      {dims.dpr}
      <br />
      UA: {dims.ua}
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const user = usersByRole[role];

  return (
    <div className="app">
      <Header user={user} role={role} onChangeRole={setRole} />
      <SplashScreen role={role} />
      <div className="footer" style={{ paddingBottom: 60 }}>
        Switchboard prototype · role-switch demo · mocked data
      </div>
      <DebugOverlay />
    </div>
  );
}
