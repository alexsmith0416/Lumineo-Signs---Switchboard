interface AppTopbarProps {
  title: string;
  onMenu?: () => void;
}

export default function AppTopbar({ title, onMenu }: AppTopbarProps) {
  return (
    <header className="app-topbar">
      {onMenu && (
        <button
          type="button"
          className="app-topbar__menu"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
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
        <div className="app-topbar__search" role="search" aria-label="Search">
          <span aria-hidden="true">⌕</span>
          <span>Search jobs, customers, dates…</span>
        </div>
        <div className="app-topbar__user">
          <span className="app-topbar__avatar">AS</span>
          <div className="app-topbar__user-info">
            <span className="app-topbar__user-name">Alex Smith</span>
            <span className="app-topbar__user-role">OPERATIONS</span>
          </div>
        </div>
      </div>
    </header>
  );
}
