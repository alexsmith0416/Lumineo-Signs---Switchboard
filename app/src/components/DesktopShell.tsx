import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { LumineoLogo } from "./LumineoLogo";
import {
  CalendarIcon,
  CameraIcon,
  CheckCircle,
  ClockIcon,
  EditIcon,
  HomeIcon,
  PowerIcon,
  WifiOffIcon,
} from "./icons";
import { useStore } from "../store";
import { CURRENT_EMPLOYEE } from "../lib/mockData";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <HomeIcon size={18} />, match: (p) => p === "/" },
  { to: "/punch-in", label: "Punch In", icon: <ClockIcon size={18} /> },
  {
    to: "/capture",
    label: "Photos",
    icon: <CameraIcon size={18} />,
    match: (p) => p.startsWith("/capture") || p.startsWith("/gallery"),
  },
  { to: "/history", label: "History", icon: <CalendarIcon size={18} /> },
  { to: "/edit-request", label: "Request Edit", icon: <EditIcon size={18} /> },
  { to: "/admin", label: "Admin", icon: <CheckCircle size={18} /> },
  { to: "/settings", label: "Settings", icon: <PowerIcon size={18} /> },
];

export function DesktopShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isOffline = useStore((s) => s.isOffline);
  const queueLen = useStore((s) => s.queue.length);
  const firstName = CURRENT_EMPLOYEE.displayName.split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f5f9]">
      <header className="h-14 bg-navy flex items-center px-5 gap-4 text-white shrink-0 shadow-md">
        <Link to="/" className="flex items-center gap-3" aria-label="Lumineo Signs">
          <LumineoLogo size={36} color="#E8151B" />
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-extrabold tracking-wider">LUMINEO SIGNS</span>
            <span className="text-[10px] font-medium opacity-80 uppercase tracking-widest">
              Time & Photo
            </span>
          </div>
        </Link>
        <div className="flex-1" />
        {isOffline && (
          <span className="bg-[#fde68a] text-[#92400e] text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
            <WifiOffIcon size={14} /> Offline · {queueLen} queued
          </span>
        )}
        <div className="flex items-center gap-2.5 bg-white/10 px-3 py-1.5 rounded-full">
          <div className="w-8 h-8 rounded-full bg-red flex items-center justify-center text-white text-[13px] font-extrabold">
            {firstName[0]}
          </div>
          <div className="flex flex-col leading-tight text-[12px]">
            <span className="font-extrabold">{CURRENT_EMPLOYEE.displayName}</span>
            <span className="opacity-80 text-[10px]">
              {CURRENT_EMPLOYEE.bcResourceNo} · {CURRENT_EMPLOYEE.role}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <nav className="w-[220px] bg-white border-r border-gray-200 flex flex-col py-3 shrink-0">
          <div className="px-4 pb-2 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
            Workspace
          </div>
          {NAV.map((item) => {
            const isActive = item.match
              ? item.match(location.pathname)
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg text-[13px] font-semibold transition-colors ${
                  isActive ? "bg-navy-bg text-navy" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className={isActive ? "text-navy" : "text-gray-500"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <div className="flex-1" />
          <div className="mx-2 mt-2 p-3 rounded-lg bg-navy-bg text-[11px] text-navy leading-snug">
            <div className="font-extrabold uppercase tracking-wider text-[10px] mb-1">
              Demo prototype
            </div>
            All punches, photos, and edits stay on this device — nothing is sent over the network.
          </div>
        </nav>

        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
