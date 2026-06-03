import type { Project } from '../repo';

interface Props {
  active: Project | null;
  view: 'editor' | 'proposal' | 'bc';
  onChangeView: (v: 'editor' | 'proposal' | 'bc') => void;
  onExportBC: () => void;
  onNewProject: () => void;
}

export function Header({ active, view, onChangeView, onExportBC, onNewProject }: Props) {
  return (
    <header className="app-header">
      <h1>Lumineo Estimating</h1>
      {active && (
        <div className="header-tabs">
          <button className={view === 'editor' ? 'active' : ''} onClick={() => onChangeView('editor')}>Editor</button>
          <button className={view === 'proposal' ? 'active' : ''} onClick={() => onChangeView('proposal')}>Proposal</button>
          <button className={view === 'bc' ? 'active' : ''} onClick={() => onChangeView('bc')}>BC Export</button>
        </div>
      )}
      <div className="header-actions">
        <button className="secondary" onClick={onNewProject}>+ New estimate</button>
        {active && <button onClick={onExportBC}>Download BC .xlsx</button>}
      </div>
    </header>
  );
}
