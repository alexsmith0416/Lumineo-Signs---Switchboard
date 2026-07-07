import { IconMoon, IconPrint, IconReset, IconSun, IconWind } from './icons';
import type { Theme } from './useTheme';

export type View = 'calc' | 'specs';

interface Props {
  projectName: string;
  view: View;
  theme: Theme;
  onChangeView: (v: View) => void;
  onToggleTheme: () => void;
  onPrint: () => void;
  onReset: () => void;
}

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'calc', label: 'Calculator' },
  { id: 'specs', label: 'Specifications' },
];

// Standalone shell for now (no Switchboard sidebar), so the topbar carries
// the brand block that normally lives at the top of the sidebar.
export function Topbar({ projectName, view, theme, onChangeView, onToggleTheme, onPrint, onReset }: Props) {
  return (
    <header className="tb">
      <div className="tb-brand" aria-hidden="true">
        <span className="tb-brand-mark"><IconWind size={20} /></span>
        <span className="tb-brand-text">
          <span className="tb-brand-name">LUMINEO SIGNS</span>
          <span className="tb-brand-sub">SWITCHBOARD</span>
        </span>
      </div>

      <div className="tb-head">
        <p className="tb-eyebrow">SWITCHBOARD · WIND LOAD</p>
        <h1 className="tb-title">{projectName.trim() || 'Wind Load Calculator'}</h1>
      </div>

      <div className="tb-actions">
        <div className="seg" role="tablist" aria-label="View">
          {VIEWS.map(v => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              className={`seg-btn${view === v.id ? ' active' : ''}`}
              onClick={() => onChangeView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button className="btn-soft" onClick={onPrint} title="Print a calculation summary">
          <IconPrint size={16} />
          <span>Print</span>
        </button>

        <button className="btn-soft" onClick={onReset} title="Reset all inputs to defaults">
          <IconReset size={16} />
          <span>Reset</span>
        </button>

        <button
          className="btn-soft"
          onClick={onToggleTheme}
          title="Toggle light / dark theme"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <IconMoon size={16} /> : <IconSun size={16} />}
          <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </header>
  );
}
