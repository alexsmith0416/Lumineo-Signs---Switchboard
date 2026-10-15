import { useState } from "react";
import type { Project } from "../domain/types";
import { Progress, StatusPill, formatDate } from "../components/ui";
import { useSpecStore } from "../store/spec-store";

/** Projects group specs (e.g. a multi-site customer rollout). */
export default function Projects({ onOpenSpec, canEdit }: { onOpenSpec: (id: string) => void; canEdit: boolean }) {
  const projects = useSpecStore((s) => s.projects);
  const specs = useSpecStore((s) => s.specs);
  const lines = useSpecStore((s) => s.lines);
  const saveProject = useSpecStore((s) => s.saveProject);
  const deleteProject = useSpecStore((s) => s.deleteProject);
  const [selectedId, setSelectedId] = useState("");
  const selected = projects.find((p) => p.id === selectedId);
  const [draft, setDraft] = useState<Project | null>(null);
  const editing = draft ?? selected ?? null;

  const startNew = () => {
    const p: Project = { id: crypto.randomUUID(), name: "", customerName: "", notes: "", createdAt: new Date().toISOString() };
    setDraft(p);
    setSelectedId("");
  };

  const projectSpecs = editing ? specs.filter((s) => s.projectId === editing.id) : [];
  const projectLines = lines.filter((l) => projectSpecs.some((s) => s.id === l.specId));

  return (
    <div className="sbp-page">
      <div className="sbp-two-col">
        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 8 }}>
            <div className="sbp-caption">Projects</div>
            <div className="sbp-spacer" />
            {canEdit && (
              <button type="button" className="btn-primary" onClick={startNew}>
                + New Project
              </button>
            )}
          </div>
          {projects.length === 0 && <div className="sbp-muted">No projects yet.</div>}
          {projects.map((p) => (
            <div key={p.id} className="sbp-list-item" onClick={() => { setDraft(null); setSelectedId(p.id); }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{p.name || "Untitled"}</div>
                <div className="sbp-muted" style={{ fontSize: 12 }}>
                  {p.customerName} · {specs.filter((s) => s.projectId === p.id).length} specs
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sbp-card">
          {!editing ? (
            <div className="sbp-muted">Pick a project, or start a new one.</div>
          ) : (
            <>
              <div className="sbp-grid-fields">
                <div className="sbp-field">
                  <label>Name</label>
                  <input className="sbp-input" disabled={!canEdit} value={editing.name} onChange={(e) => (draft ? setDraft({ ...draft, name: e.target.value }) : saveProject({ ...editing, name: e.target.value }))} />
                </div>
                <div className="sbp-field">
                  <label>Customer</label>
                  <input className="sbp-input" disabled={!canEdit} value={editing.customerName} onChange={(e) => (draft ? setDraft({ ...draft, customerName: e.target.value }) : saveProject({ ...editing, customerName: e.target.value }))} />
                </div>
              </div>
              <div className="sbp-field" style={{ marginTop: 10 }}>
                <label>Notes</label>
                <textarea className="sbp-textarea" disabled={!canEdit} value={editing.notes} onChange={(e) => (draft ? setDraft({ ...draft, notes: e.target.value }) : saveProject({ ...editing, notes: e.target.value }))} />
              </div>
              {draft && (
                <div className="sbp-row" style={{ marginTop: 10 }}>
                  <button type="button" className="btn-primary" disabled={!draft.name.trim()} onClick={() => { saveProject(draft); setSelectedId(draft.id); setDraft(null); }}>
                    Create Project
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                </div>
              )}
              {!draft && (
                <>
                  <div className="sbp-kpis">
                    <div className="sbp-kpi">
                      <div className="sbp-caption">Specs</div>
                      <div className="sbp-kpi__value">{projectSpecs.length}</div>
                    </div>
                    <div className="sbp-kpi">
                      <div className="sbp-caption">Signs</div>
                      <div className="sbp-kpi__value">{projectLines.length}</div>
                    </div>
                    <div className="sbp-kpi">
                      <div className="sbp-caption">Total Units</div>
                      <div className="sbp-kpi__value">{projectLines.reduce((n, l) => n + l.quantity, 0)}</div>
                    </div>
                  </div>
                  <div className="sbp-caption" style={{ marginBottom: 6 }}>
                    Specs in this project
                  </div>
                  {projectSpecs.map((s) => {
                    const ls = lines.filter((l) => l.specId === s.id);
                    return (
                      <div key={s.id} className="sbp-list-item" onClick={() => onOpenSpec(s.id)}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>
                            {s.number} · {s.customerName || s.description}
                          </div>
                          <div className="sbp-muted" style={{ fontSize: 12 }}>
                            {ls.length} signs · {formatDate(s.modifiedAt)}
                          </div>
                        </div>
                        <Progress pct={ls.length ? ls.reduce((n, l) => n + l.completedPct, 0) / ls.length : 0} />
                        <StatusPill status={s.status} />
                      </div>
                    );
                  })}
                  {projectSpecs.length === 0 && <div className="sbp-muted">Add specs to this project from the Builder (Project field).</div>}
                  {canEdit && (
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="btn-danger" onClick={() => { deleteProject(editing.id); setSelectedId(""); }}>
                        Delete Project
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
