import { useTheme } from "../theme";

interface AppHeaderProps {
  title: string;
  onMenu?: () => void;
}

export default function AppHeader({ title, onMenu }: AppHeaderProps) {
  const { theme, toggle } = useTheme();
  const nextIsDark = theme === "light";
  return (
    <header className="app-header">
      {onMenu && (
        <button
          className="app-header__menu"
          aria-label="Open menu"
          onClick={onMenu}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      )}
      <div className="app-header__logo">
        <div className="app-header__logo-text">
          <span className="lumineo">LUMINEO</span>
          <span className="signs">SIGNS</span>
        </div>
      </div>
      <div className="app-header__title">{title}</div>
      <div className="app-header__actions">
        <button
          className="app-header__theme-toggle"
          onClick={toggle}
          type="button"
          aria-label={nextIsDark ? "Switch to dark mode" : "Switch to light mode"}
          title={nextIsDark ? "Switch to dark mode" : "Switch to light mode"}
        >
          <span aria-hidden="true">{nextIsDark ? "🌙" : "☀"}</span>
          <span className="app-header__theme-label">{nextIsDark ? "Dark" : "Light"}</span>
        </button>
        <button className="app-header__action" aria-label="Home" type="button">⌂</button>
        <button className="app-header__action" aria-label="Calendar" type="button">▦</button>
        <button className="app-header__action" aria-label="Settings" type="button">⚙</button>
      </div>
    </header>
  );
}
