interface AppHeaderProps {
  title: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__logo">
        <div className="app-header__logo-text">
          <span className="lumineo">LUMINEO</span>
          <span className="signs">SIGNS</span>
        </div>
      </div>
      <div className="app-header__title">{title}</div>
      <div className="app-header__actions">
        <button className="app-header__action" aria-label="Home" type="button">⌂</button>
        <button className="app-header__action" aria-label="Calendar" type="button">▦</button>
        <button className="app-header__action" aria-label="Settings" type="button">⚙</button>
      </div>
    </header>
  );
}
