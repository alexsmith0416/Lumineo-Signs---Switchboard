interface TopbarProps {
  title: string;
  /** Mobile only — opens the nav drawer. The button is hidden ≥900px via CSS. */
  onMenu?: () => void;
}

export default function Topbar({ title, onMenu }: TopbarProps) {
  return (
    <header className="app-topbar">
      {onMenu && (
        <button
          type="button"
          className="app-topbar__menu"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      )}
      <div className="app-topbar__lead">
        <span className="app-topbar__eyebrow">SWITCHBOARD · PROJECT SCHEDULER</span>
        <span className="app-topbar__title">{title}</span>
      </div>
      <div className="app-topbar__cluster">
        <div className="app-topbar__search" aria-hidden="true">
          <span>⌕</span>
          <span>Search schedules…</span>
        </div>
        <div className="app-topbar__user">
          <div className="app-topbar__avatar">AS</div>
          <div className="app-topbar__user-info">
            <span className="app-topbar__user-name">Alex Smith</span>
            <span className="app-topbar__user-role">Scheduler</span>
          </div>
        </div>
      </div>
    </header>
  );
}
