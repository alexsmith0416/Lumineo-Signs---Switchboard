import { useEffect, useMemo, useState } from 'react';

import { LocalCatalogRepo, LocalEstimateRepo } from '../repo';
import type { CatalogItem, WorkCode, Project } from '../repo';
import { computeProject } from '../lib/engine';
import { buildProposal } from '../lib/proposal';
import { downloadBCExport } from '../lib/bcExport';
import { PIECE_TYPES } from '../data/pieceTypes';

import { Header } from './Header';
import { ProjectList } from './ProjectList';
import { ProjectEditor } from './ProjectEditor';
import { ProposalView } from './ProposalView';
import { BCExportView } from './BCExportView';

type View = 'editor' | 'proposal' | 'bc';

function newProject(): Project {
  return {
    id: `est-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    jobNumber: '',
    jobName: '',
    estimator: '',
    description: '',
    pieces: [],
  };
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly CatalogItem[]>([]);
  const [workCodes, setWorkCodes] = useState<readonly WorkCode[]>([]);
  const [view, setView] = useState<View>('editor');

  // Load saved projects + reference data on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, cat, wc] = await Promise.all([
        LocalEstimateRepo.list(),
        LocalCatalogRepo.list(),
        LocalCatalogRepo.listWorkCodes(),
      ]);
      if (cancelled) return;
      setProjects([...saved]);
      setCatalog(cat);
      setWorkCodes(wc);
      if (saved.length && !activeId) setActiveId(saved[0].id);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => projects.find(p => p.id === activeId) ?? null, [projects, activeId]);
  const computed = useMemo(() => (active ? computeProject(active) : null), [active]);

  function saveProject(next: Project) {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === next.id);
      const out = idx >= 0 ? prev.map(p => (p.id === next.id ? next : p)) : [...prev, next];
      // Fire-and-forget persistence — fine for the local repo.
      void LocalEstimateRepo.save(next);
      return out;
    });
  }

  function createProject() {
    const p = newProject();
    setProjects(prev => [...prev, p]);
    setActiveId(p.id);
    void LocalEstimateRepo.save(p);
    setView('editor');
  }

  function deleteProject(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id));
    void LocalEstimateRepo.delete(id);
    if (activeId === id) setActiveId(null);
  }

  function exportBC() {
    if (!active) return;
    downloadBCExport(active);
  }

  return (
    <div className="app-shell">
      <Header
        active={active}
        view={view}
        onChangeView={setView}
        onExportBC={exportBC}
        onNewProject={createProject}
      />
      <main className="app-main">
        <aside className="app-sidebar">
          <ProjectList
            projects={projects}
            activeId={activeId}
            onPick={(id) => { setActiveId(id); setView('editor'); }}
            onCreate={createProject}
            onDelete={deleteProject}
          />
        </aside>
        <section className="app-content">
          {!active && (
            <div className="empty-state">
              <h2>No estimate selected</h2>
              <p>Create a new estimate to start adding sign pieces, or pick one from the list.</p>
              <button className="primary" onClick={createProject}>+ New estimate</button>
              <p className="muted" style={{ marginTop: 32 }}>
                {PIECE_TYPES.length} sign piece types available
                {' · '}
                {catalog.length} catalog items
                {' · '}
                {workCodes.length} work codes
              </p>
            </div>
          )}
          {active && view === 'editor' && computed && (
            <ProjectEditor
              project={active}
              computed={computed}
              catalog={catalog}
              workCodes={workCodes}
              onChange={saveProject}
            />
          )}
          {active && view === 'proposal' && computed && (
            <ProposalView lines={buildProposal(computed.pieces)} total={computed.total} project={active} />
          )}
          {active && view === 'bc' && computed && <BCExportView project={active} computed={computed} />}
        </section>
      </main>
    </div>
  );
}
