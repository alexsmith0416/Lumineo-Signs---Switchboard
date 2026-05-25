import { useState } from "react";
import type { Role } from "./types";
import { usersByRole } from "./data/mockData";
import Header from "./components/Header";
import SplashScreen from "./components/SplashScreen";

export default function App() {
  const [role, setRole] = useState<Role>("Operations");
  const user = usersByRole[role];

  return (
    <div className="app">
      <Header user={user} role={role} onChangeRole={setRole} />
      <SplashScreen role={role} />
      <div className="footer">
        Lumineo Switchboard prototype · role-switch demo · backed by mocked data ·{" "}
        <a href="https://github.com/alexsmith0416/Lumineo-Signs---Switchboard/blob/claude/master-power-apps-design-05pjY/docs/08-splash-screen-spec.md">
          spec
        </a>
      </div>
    </div>
  );
}
