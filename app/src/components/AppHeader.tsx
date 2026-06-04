import { Link, useNavigate } from "react-router-dom";
import { HomeIcon } from "./icons";
import { LumineoLogo } from "./LumineoLogo";
import { useStore } from "../store";

interface Props {
  subtitle?: string;
  adminBadge?: boolean;
}

export function AppHeader({ subtitle = "TIME & PHOTO", adminBadge = false }: Props) {
  const navigate = useNavigate();
  const isOffline = useStore((s) => s.isOffline);

  return (
    <div className="h-11 bg-navy flex items-center px-2.5 gap-2.5 text-white shrink-0 lg:hidden">
      <Link
        to="/"
        className="flex items-center justify-center shrink-0"
        aria-label="Lumineo Signs"
      >
        <LumineoLogo size={32} color="#E8151B" />
      </Link>
      <div className="flex flex-col leading-tight flex-1 min-w-0">
        <span className="text-[13px] font-extrabold tracking-wider">LUMINEO SIGNS</span>
        <span className="text-[9px] font-medium opacity-80 uppercase tracking-widest truncate">
          {subtitle}
          {adminBadge ? " · ADMIN" : ""}
        </span>
      </div>
      {isOffline && (
        <span className="bg-[#fde68a] text-[#92400e] text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
          Offline
        </span>
      )}
      <button
        onClick={() => navigate("/")}
        className="w-11 h-11 bg-navy-light rounded-[10px] flex items-center justify-center text-white shrink-0"
        aria-label="Home"
      >
        <HomeIcon />
      </button>
    </div>
  );
}
