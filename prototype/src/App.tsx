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
        Switchboard prototype · role-switch demo · mocked data
      </div>
    </div>
  );
}
