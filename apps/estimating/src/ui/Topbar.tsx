import type { Project } from '../repo';
import { IconDownload, IconPlus, IconSearch } from './icons';

export type View = 'editor' | 'proposal' | 'bc';

interface Props {
  active: Project | null;
  view: View;
  search: string;
  onSearch: (q: string) => void;
  onChangeView: (v: View) => void;
  onExportBC: () => void;
  onNewProject: () => void;
}

const VIEWS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'bc', label: 'BC Export' },
];

export function Topbar({ active, view, search, onSearch, onChangeView, onExportBC, onNewProject }: Props) {
  const title = active ? active.jobName || active.jobNumber || 'Untitled estimate' : 'Estimating';

  return (
    <header className="tb">
      <div className="tb-head">
        <p className="tb-eyebrow">SWITCHBOARD · ESTIMATING</p>
        <h1 className="tb-title">{title}</h1>
      </div>

      <div className="tb-actions">
        <div className="tb-search">
          <IconSearch size={16} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search estimates…"
            aria-label="Search estimates"
          />
        </div>

        {active && (
          <div className="seg" role="tablist" aria-label="Estimate view">
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
        )}

        {active && (
          <button className="btn-soft" onClick={onExportBC}>
            <IconDownload size={16} />
            <span>BC .xlsx</span>
          </button>
        )}

        <button className="btn-primary" onClick={onNewProject}>
          <IconPlus size={16} />
          <span>New estimate</span>
        </button>

        <div className="tb-user">
          <span className="tb-avatar" aria-hidden="true">AS</span>
          <span className="tb-user-text">
            <span className="tb-user-name">Alex Smith</span>
            <span className="tb-user-role">ESTIMATOR</span>
          </span>
        </div>
      </div>
    </header>
  );
}
