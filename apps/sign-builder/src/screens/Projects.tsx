// Projects — two-pane workspace. Left: rail of all Projects. Right: selected
// project metadata + KPI strip + signs-in-project list. Re-skinned to the
// design system panel + list-row pattern; brand-fill cards for KPIs.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { statusTone } from "../ui/specStatus";
import { Banner } from "../ui/Banner";
import { emptyProject, type Project } from "../domain/Project";
import type { SignSpec } from "../domain/SignSpec";

export function Projects() {
  const navigate = useNavigate();
  const {
    projects,
    loadingProjects,
    recent,
    saveProject,
    deleteProject,
    loadSpec,
    newSpec,
  } = useSpec();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [savingError, setSavingError] = useState(false);

  useEffect(() => {
    if (!activeId && projects.length > 0) setActiveId(projects[0].id ?? null);
  }, [projects, activeId]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  const projectSigns: SignSpec[] = useMemo(() => {
    if (!active?.id) return [];
    return recent.filter((s) => s.projectId === active.id);
  }, [recent, active?.id]);

  const totalUnits = projectSigns.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  async function startNew() {
    setSavingError(false);
    const draft = { ...emptyProject(), name: "New Project" };
    try {
      const saved = await saveProject(draft);
      if (saved.id) setActiveId(saved.id);
      setEditing(saved);
    } catch {
      setSavingError(true);
    }
  }

  async function commitEdit() {
    if (!editing) return;
    if (!editing.name.trim()) {
      setSavingError(true);
      return;
    }
    setSavingError(false);
    try {
      await saveProject(editing);
      setEditing(null);
    } catch {
      setSavingError(true);
    }
  }

  function openNewSign() {
    if (!active?.id) return;
    newSpec({ projectId: active.id, projectName: active.name });
    navigate("/builder");
  }

  function openSign(s: SignSpec) { loadSpec(s); navigate("/builder"); }

  async function confirmDelete(id: string) {
    setConfirming(null);
    await deleteProject(id);
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="sbp-projects">
      <aside className="sbp-projects__list">
        <div className="sbp-projects__list-head">
          <span className="lum-section-label">Projects</span>
          <button type="button" className="lum-btn" style={{ padding: "5px 12px", fontSize: 11 }} onClick={startNew}>
            + New
          </button>
        </div>
        {loadingProjects ? (
          <div className="sbp-projects__empty">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="sbp-projects__empty">No projects yet — start one above.</div>
        ) : (
          projects.map((p) => {
            const signs = recent.filter((s) => s.projectId === p.id);
            const units = signs.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
            return (
              <button
                key={p.id}
                type="button"
                className={"sbp-projects__item" + (p.id === activeId ? " is-active" : "")}
                onClick={() => setActiveId(p.id ?? null)}
              >
                <span className="sbp-projects__item-name">{p.name || "Untitled"}</span>
                <span className="sbp-projects__item-meta">
                  {p.customerName || "—"} · {signs.length} sign{signs.length === 1 ? "" : "s"} · {units} units
                </span>
              </button>
            );
          })
        )}
      </aside>

      <section className="sbp-projects__detail">
        {!active ? (
          <div className="sbp-empty">Select a project on the left, or create a new one.</div>
        ) : (
          <>
            {savingError ? (
              <Banner tone="red">Could not save — project must have a name.</Banner>
            ) : null}

            <div className="lum-card">
              {editing && editing.id === active.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <span className="lum-field-label">Project Name</span>
                    <input
                      autoFocus
                      className="lum-input"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="lum-field-label">Customer</span>
                    <input
                      className="lum-input"
                      value={editing.customerName}
                      onChange={(e) => setEditing({ ...editing, customerName: e.target.value })}
                      placeholder="Customer name"
                    />
                  </div>
                  <div>
                    <span className="lum-field-label">Notes</span>
                    <textarea
                      className="lum-input"
                      rows={3}
                      value={editing.notes}
                      onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                      placeholder="Install context, dependencies, customer requests…"
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="lum-btn is-primary" onClick={commitEdit}>
                      Save Project
                    </button>
                    <button type="button" className="lum-btn" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sbp-projects__header">
                    <div className="sbp-projects__header-text">
                      <span className="lum-section-label">Project</span>
                      <h2 style={{ margin: 0, fontSize: 22, color: "var(--text-primary)", fontWeight: 800 }}>
                        {active.name || "Untitled project"}
                      </h2>
                      {active.customerName ? (
                        <p style={{ margin: "6px 0 0", color: "var(--text-dim)", fontSize: 12 }}>
                          {active.customerName}
                        </p>
                      ) : null}
                    </div>
                    <div className="sbp-projects__header-actions">
                      <button type="button" className="lum-btn" onClick={() => setEditing(active)}>
                        Edit
                      </button>
                      <button type="button" className="lum-btn is-primary" onClick={openNewSign}>
                        + New Sign
                      </button>
                      {confirming === active.id ? (
                        <>
                          <button
                            type="button"
                            className="lum-btn is-danger"
                            onClick={() => active.id && confirmDelete(active.id)}
                          >
                            Confirm delete
                          </button>
                          <button type="button" className="lum-btn" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="lum-btn"
                          onClick={() => active.id && setConfirming(active.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {active.notes ? (
                    <p style={{ margin: "12px 0 0", color: "var(--text-mid)", fontSize: 12, whiteSpace: "pre-wrap" }}>
                      {active.notes}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="sbp-kpi-strip">
              <div className="sbp-kpi">
                <div className="sbp-kpi__label">Signs</div>
                <div className="sbp-kpi__value lum-num">{projectSigns.length}</div>
              </div>
              <div className="sbp-kpi">
                <div className="sbp-kpi__label">Total Units</div>
                <div className="sbp-kpi__value lum-num">{totalUnits}</div>
              </div>
              <div className="sbp-kpi">
                <div className="sbp-kpi__label">Created</div>
                <div className="sbp-kpi__value" style={{ fontSize: 14 }}>
                  {new Date(active.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="lum-panel">
              <div className="lum-panel__head">
                <span>Signs in this project</span>
                <button
                  type="button"
                  className="lum-btn"
                  style={{ padding: "5px 12px", fontSize: 11 }}
                  onClick={openNewSign}
                >
                  + Add Sign
                </button>
              </div>
              {projectSigns.length === 0 ? (
                <div className="sbp-list-empty">No signs in this project yet — start one with "+ Add Sign".</div>
              ) : (
                projectSigns.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="sbp-list-row"
                    onClick={() => openSign(s)}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid var(--border-soft)" }}
                  >
                    <div className="sbp-list-row__main">
                      <span className="sbp-list-row__title">{s.name || s.productCode || "Untitled"}</span>
                      <span className="sbp-list-row__sub">
                        {s.signTypeCode || "—"} · Qty {s.quantity}{s.productCode ? ` · ${s.productCode}` : ""}
                      </span>
                    </div>
                    <div className="sbp-list-row__right">
                      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
