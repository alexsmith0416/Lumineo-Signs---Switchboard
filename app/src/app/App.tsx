import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { Sidebar } from "../ui/Sidebar";
import { Topbar } from "../ui/Topbar";
import { Dashboard } from "../screens/Dashboard";
import { Builder } from "../screens/Builder";
import { Gallery } from "../screens/Gallery";
import { Projects } from "../screens/Projects";
import { Reports } from "../screens/Reports";
import { SpecProvider, useSpec } from "./SpecContext";
import { useLaunchParams } from "./launchParams";

export default function App() {
  return (
    <SpecProvider>
      <Shell />
    </SpecProvider>
  );
}

function Shell() {
  const launch = useLaunchParams();
  const { spec } = useSpec();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="lum-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lum-shell__main">
        <Topbar
          launch={launch}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          productCode={spec.productCode}
        />
        <main className="lum-shell__content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Reports />} />
            <Route path="/help" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
