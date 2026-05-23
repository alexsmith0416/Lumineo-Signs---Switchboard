import { Route, Routes } from "react-router-dom";
import { Header } from "../ui/Header";
import { Dashboard } from "../screens/Dashboard";
import { Builder } from "../screens/Builder";
import { Gallery } from "../screens/Gallery";
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
  return (
    <div className="lum-app">
      <Header launch={launch} productCode={spec.productCode} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/builder" element={<Builder />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </div>
  );
}
