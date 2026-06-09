import { useEffect, useMemo, useState } from 'react';

import { LocalCatalogRepo, LocalEstimateRepo } from '../repo';
import type { CatalogItem, WorkCode, Project } from '../repo';
import { computeProject } from '../lib/engine';
import { buildProposal } from '../lib/proposal';
import { downloadBCExport } from '../lib/bcExport';
import { PIECE_TYPES } from '../data/pieceTypes';
import { clearImportHash, parseSBPPayloadFromHash, projectFromPayload } from '../lib/sbpPayload';
import { signBuilderSpecUrl } from '../lib/config';

import { Sidebar } from './Sidebar';
import { Topbar, type View } from './Topbar';
import { ProjectList } from './ProjectList';
import { ProjectEditor } from './ProjectEditor';
import { ProposalView } from './ProposalView';
import { BCExportView } from './BCExportView';
import { useTheme } from './useTheme';

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
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly CatalogItem[]>([]);
  const [workCodes, setWorkCodes] = useState<readonly WorkCode[]>([]);
  const [view, setView] = useState<View>('editor');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [importBanner, setImportBanner] = useState<{ text: string; sbpHref?: string } | null>(null);

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
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sign Builder Pro handoff — if the URL hash carries an import payload,
  // build the project + pieces, persist them, and activate. Runs after the
  // initial load (so we don't race the saved-projects fetch) and again on any
  // `hashchange`, so the import fires whether SBP opens a fresh tab
  // (window.open) or navigates an already-open Estimating tab. See
  // docs/16-estimating.md (§ "Send to Estimating") + the SBP contract in
  // docs/estimating-integration.md; sbpPayload.ts validates shape + version.
  useEffect(() => {
    if (!loaded) return;

    function runImport() {
      const payload = parseSBPPayloadFromHash();
      if (!payload) return;
      const project = projectFromPayload(payload);
      if (project.pieces.length === 0) {
        console.warn('[App] SBP payload had no recognised pieces — not creating project.');
        setImportBanner({ text: 'Sign Builder Pro sent a sign with no recognised piece types — nothing to import.' });
        clearImportHash();
        return;
      }
      setProjects(prev => [...prev, project]);
      void LocalEstimateRepo.save(project);
      setActiveId(project.id);
      setView('editor');
      clearImportHash();
      setImportBanner({
        text: `Imported ${project.pieces.length} piece${project.pieces.length === 1 ? '' : 's'} from Sign Builder Pro — review and finalize below.`,
        sbpHref: payload.specId ? signBuilderSpecUrl(payload.specId) : undefined,
      });
      console.info(`[App] imported "${project.jobName}" from Sign Builder Pro`);
    }

    runImport();
    window.addEventListener('hashchange', runImport);
    return () => window.removeEventListener('hashchange', runImport);
  }, [loaded]);

  const active = useMemo(() => projects.find(p => p.id === activeId) ?? null, [projects, activeId]);
  const computed = useMemo(() => (active ? computeProject(active) : null), [active]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      `${p.jobNumber} ${p.jobName} ${p.estimator} ${p.description}`.toLowerCase().includes(q),
    );
  }, [projects, search]);

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
    if (!computed) return;
    downloadBCExport(computed);
  }

  return (
    <div className="app-shell">
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />

      <div className="app-body">
        <Topbar
          active={active}
          view={view}
          search={search}
          onSearch={setSearch}
          onChangeView={setView}
          onExportBC={exportBC}
          onNewProject={createProject}
        />

        <main className="app-main">
          {importBanner && (
            <div className="import-banner" role="status">
              <span>{importBanner.text}</span>
              {importBanner.sbpHref && (
                <a className="import-banner-link" href={importBanner.sbpHref} target="_blank" rel="noopener noreferrer">
                  Open original in Sign Builder Pro ↗
                </a>
              )}
              <button className="import-banner-close" aria-label="Dismiss" onClick={() => setImportBanner(null)}>×</button>
            </div>
          )}

          <div className="app-grid">
            <aside className="panel app-estimates">
              <ProjectList
                projects={filtered}
                activeId={activeId}
                onPick={(id) => { setActiveId(id); setView('editor'); }}
                onCreate={createProject}
                onDelete={deleteProject}
              />
            </aside>

            <section className="panel app-content">
              {!active && (
                <div className="empty-state">
                  <h2>No estimate selected</h2>
                  <p>Create a new estimate to start adding sign pieces, or pick one from the list. Signs sent over from <b>Sign Builder Pro</b> land here automatically.</p>
                  <button className="btn-primary" onClick={createProject}>+ New estimate</button>
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
          </div>
        </main>
      </div>
    </div>
  );
}
