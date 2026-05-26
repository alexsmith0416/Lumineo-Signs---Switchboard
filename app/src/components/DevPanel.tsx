import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { useState } from "react";

const links: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/punch-in", label: "Punch In" },
  { to: "/capture", label: "Capture" },
  { to: "/gallery", label: "Gallery" },
  { to: "/history", label: "History" },
  { to: "/edit-request", label: "Edit Request" },
  { to: "/admin", label: "Admin" },
  { to: "/settings", label: "Settings" },
];

export function DevPanel() {
  const location = useLocation();
  const isOffline = useStore((s) => s.isOffline);
  const toggleOffline = useStore((s) => s.toggleOffline);
  const queueLen = useStore((s) => s.queue.length);
  const resetDemoData = useStore((s) => s.resetDemoData);
  const [open, setOpen] = useState(true);

  return (
    <div className="hidden lg:flex flex-col fixed top-6 right-6 w-[230px] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="bg-navy text-white px-3 py-2 text-xs font-bold tracking-wider uppercase flex justify-between items-center"
      >
        <span>Prototype Nav</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <>
          <nav className="flex flex-col p-2 gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  location.pathname === l.to || (l.to === "/gallery" && location.pathname.startsWith("/gallery"))
                    ? "bg-navy text-white"
                    : "text-navy hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-gray-100 p-3 flex flex-col gap-2">
            <button
              onClick={toggleOffline}
              className={`text-xs font-bold px-3 py-2 rounded-md ${
                isOffline ? "bg-[#fde68a] text-[#92400e]" : "bg-gray-100 text-navy"
              }`}
            >
              {isOffline ? "● Offline (toggle)" : "○ Online (toggle offline)"}
            </button>
            <div className="text-[11px] text-gray-500 font-medium">
              {queueLen} item{queueLen === 1 ? "" : "s"} in queue
            </div>
            <button
              onClick={() => {
                if (confirm("Reset all demo data?")) resetDemoData();
              }}
              className="text-[11px] text-gray-500 hover:text-red font-semibold text-left"
            >
              Reset demo data
            </button>
          </div>
        </>
      )}
    </div>
  );
}
