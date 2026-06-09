import type { Theme } from './useTheme';
import {
  IconBuilder,
  IconCalendar,
  IconDashboard,
  IconEstimating,
  IconHelp,
  IconMoon,
  IconSales,
  IconSettings,
  IconSun,
} from './icons';

// Switchboard shell sidebar (DESIGN.md §5 / §6.1). Fixed 248px, brand
// block, MAIN / APPS / OTHER nav sections, and a theme toggle pill at the
// bottom. Estimating is the active app; the sibling sub-apps render as
// nav items so the Estimating screen reads as one cohesive product.
// Cross-app links point at the deployed Switchboard hosts; they're
// best-effort and degrade gracefully in a standalone deploy.

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: (p: { size?: number }) => JSX.Element;
  readonly href?: string;
}

const MAIN: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard, href: 'https://switchboard.lumineosigns.com/' },
  { id: 'schedule', label: 'My Schedule', icon: IconCalendar, href: 'https://switchboard.lumineosigns.com/#/schedule' },
];

const APPS: readonly NavItem[] = [
  { id: 'sign-builder', label: 'Sign Builder Pro', icon: IconBuilder, href: 'https://signbuilderpro.lumineosigns.com/' },
  { id: 'estimating', label: 'Estimating', icon: IconEstimating },
  { id: 'sales', label: 'Sales Hub', icon: IconSales, href: 'https://switchboard.lumineosigns.com/#/sales' },
];

interface Props {
  theme: Theme;
  onToggleTheme: () => void;
  activeAppId?: string;
}

export function Sidebar({ theme, onToggleTheme, activeAppId = 'estimating' }: Props) {
  return (
    <aside className="sb-sidebar">
      <div className="sb-brand">
        <div className="sb-brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8" />
          </svg>
        </div>
        <div className="sb-brand-text">
          <span className="sb-brand-name">LUMINEO SIGNS</span>
          <span className="sb-brand-sub">SWITCHBOARD</span>
        </div>
      </div>

      <nav className="sb-nav">
        <NavSection caption="MAIN" items={MAIN} activeAppId={activeAppId} />
        <NavSection caption="APPS" items={APPS} activeAppId={activeAppId} />

        <div className="sb-nav-spacer" />

        <p className="sb-caption">OTHER</p>
        <button
          type="button"
          className="sb-nav-item sb-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <IconMoon size={20} /> : <IconSun size={20} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
        <NavLink item={{ id: 'settings', label: 'Settings', icon: IconSettings }} active={false} />
        <NavLink item={{ id: 'help', label: 'Help', icon: IconHelp }} active={false} />
      </nav>
    </aside>
  );
}

function NavSection({
  caption,
  items,
  activeAppId,
}: {
  caption: string;
  items: readonly NavItem[];
  activeAppId: string;
}) {
  return (
    <>
      <p className="sb-caption">{caption}</p>
      {items.map(item => (
        <NavLink key={item.id} item={item} active={item.id === activeAppId} />
      ))}
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const className = `sb-nav-item${active ? ' active' : ''}`;
  const content = (
    <>
      <Icon size={20} />
      <span>{item.label}</span>
    </>
  );
  if (active || !item.href) {
    return (
      <div className={className} aria-current={active ? 'page' : undefined}>
        {content}
      </div>
    );
  }
  return (
    <a className={className} href={item.href}>
      {content}
    </a>
  );
}
