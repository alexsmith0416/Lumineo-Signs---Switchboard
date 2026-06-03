import { computeProject, round2 } from '../lib/engine';
import type { Project } from '../repo';

interface Props {
  projects: readonly Project[];
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function ProjectList({ projects, activeId, onPick, onCreate, onDelete }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ color: 'var(--color-navy)' }}>Estimates</strong>
        <button className="primary" onClick={onCreate}>+ New</button>
      </div>
      {projects.length === 0 && (
        <p className="muted">No saved estimates yet.</p>
      )}
      <ul className="project-list">
        {projects.map(p => {
          const total = computeProject(p).total;
          return (
            <li
              key={p.id}
              className={p.id === activeId ? 'active' : ''}
              onClick={() => onPick(p.id)}
            >
              <div className="pl-job">{p.jobNumber || '(no job #)'}</div>
              <div className="pl-name">{p.jobName || '(unnamed)'}</div>
              <div className="pl-total">${round2(total).toLocaleString()} · {p.pieces.length} pieces</div>
              <div className="pl-actions">
                <button
                  className="danger"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${p.jobName || p.jobNumber}"?`)) onDelete(p.id); }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
