import { Route, Routes } from "react-router-dom";
import { PhoneFrame } from "./components/PhoneFrame";
import { Toast } from "./components/Toast";
import { Dashboard } from "./screens/Dashboard";
import { PunchIn } from "./screens/PunchIn";
import { Capture } from "./screens/Capture";
import { Gallery } from "./screens/Gallery";
import { History } from "./screens/History";
import { EditRequest } from "./screens/EditRequest";
import { Admin } from "./screens/Admin";
import { Settings } from "./screens/Settings";
import { DevPanel } from "./components/DevPanel";

export function App() {
  return (
    <div className="min-h-screen flex items-start justify-center py-6 px-3 relative">
      <div className="w-full max-w-[400px] relative">
        <PhoneFrame>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/punch-in" element={<PunchIn />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/gallery/:jobNo?" element={<Gallery />} />
            <Route path="/history" element={<History />} />
            <Route path="/edit-request" element={<EditRequest />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          <Toast />
        </PhoneFrame>
      </div>
      <DevPanel />
    </div>
  );
}
