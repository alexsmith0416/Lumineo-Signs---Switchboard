import { SidebarIcon } from "./SidebarIcon";
import { INSTALL_TOOLS } from "./Sidebar";

/**
 * The Installation tools as tabs at the top of each of them (Oct 11, 2026):
 * Schedule · Monthly Gameplanning · Install Planner · Install Trips — the same
 * set as the sidebar's Installation group, so you can switch where you're
 * working (and on phones, where the sidebar is a drawer).
 */
export default function InstallTabs({
  current,
  onSelect,
  show,
}: {
  current: string;
  onSelect: (id: string) => void;
  /** Which tools this login has. */
  show: { monthly: boolean; planner: boolean; trips: boolean };
}) {
  const tools = INSTALL_TOOLS.filter(
    (t) => (t.id !== "monthly" || show.monthly) && (t.id !== "planner" || show.planner) && (t.id !== "trips" || show.trips),
  );
  if (tools.length < 2) return null;
  return (
    <nav className="install-tabs" aria-label="Installation tools">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`install-tabs__tab${t.id === current ? " install-tabs__tab--on" : ""}`}
          aria-current={t.id === current ? "page" : undefined}
          onClick={() => onSelect(t.id)}
        >
          <SidebarIcon name={t.icon} size={15} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
