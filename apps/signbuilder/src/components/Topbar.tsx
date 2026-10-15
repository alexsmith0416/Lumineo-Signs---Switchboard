interface TopbarProps {
  title: string;
  userName: string;
  userRole: string;
  /** The spec being built shows its live Spec Code here. */
  liveCode?: string;
}

export default function Topbar({ title, userName, userRole, liveCode }: TopbarProps) {
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <header className="app-topbar">
      <div className="app-topbar__lead">
        <span className="app-topbar__eyebrow">SIGN BUILDER</span>
        <span className="app-topbar__title">{title}</span>
      </div>
      <div className="app-topbar__cluster">
        {liveCode !== undefined && (
          <span className="sbp-code" data-tour="live-code" title="Live Spec Code of the selected sign">
            {liveCode || "—"}
          </span>
        )}
        <div className="app-topbar__user">
          <span className="app-topbar__avatar" aria-hidden="true">
            {initials || "?"}
          </span>
          <span className="app-topbar__user-info">
            <span className="app-topbar__user-name">{userName}</span>
            <span className="app-topbar__user-role">{userRole}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
