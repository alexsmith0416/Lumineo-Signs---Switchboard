// Projects screen — top-level workspace ported from the Sign Builder Pro
// Preview app's two-mode design. A Project is a named bundle of signs
// (e.g. "Westview Medical — Main Entry" containing the cabinet + the
// wayfinding + the parking signs). Individual signs that have no project
// link still live in /gallery as standalone records.

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

  // Auto-select the first project when the list lands.
  useEffect(() => {
    if (!activeId && projects.length > 0) setActiveId(projects[0].id ?? null);
  }, [projects, activeId]);

  const active = projects.find((p) => p.id === activeId) ?? null;

  // Signs that belong to the active project — pulled from the global recent
  // list, no extra fetch needed.
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
    newSpec(active.id, active.name);
    navigate("/builder");
  }

  function openSign(s: SignSpec) {
    loadSpec(s);
    navigate("/builder");
  }

  async function confirmDelete(id: string) {
    setConfirming(null);
    await deleteProject(id);
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="sbp-projects">
      <aside className="sbp-projects__list">
        <div className="sbp-projects__list-head">
          <span className="sbp-sidebar__title">Projects</span>
          <button type="button" className="lum-btn is-ghost" onClick={startNew}>
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

            <div className="lum-card sbp-projects__header">
              {editing && editing.id === active.id ? (
                <div className="sbp-projects__edit">
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
                    <button type="button" className="lum-btn is-ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sbp-projects__header-row">
                    <div className="sbp-projects__header-text">
                      <span className="lum-section-label">Project</span>
                      <h2 style={{ margin: 0, fontSize: 22, color: "var(--lum-navy)" }}>
                        {active.name || "Untitled project"}
                      </h2>
                      {active.customerName ? (
                        <p style={{ margin: "6px 0 0", color: "var(--lum-gray-500)", fontSize: 13 }}>
                          {active.customerName}
                        </p>
                      ) : null}
                    </div>
                    <div className="sbp-projects__header-actions">
                      <button type="button" className="lum-btn is-ghost" onClick={() => setEditing(active)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="lum-btn is-primary"
                        onClick={openNewSign}
                      >
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
                          <button type="button" className="lum-btn is-ghost" onClick={() => setConfirming(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="lum-btn is-ghost"
                          onClick={() => active.id && setConfirming(active.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  {active.notes ? (
                    <p style={{ margin: "12px 0 0", color: "var(--lum-gray-700)", fontSize: 13, whiteSpace: "pre-wrap" }}>
                      {active.notes}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <div className="sbp-kpis">
              <div className="lum-card"><div className="sbp-kpi__value">{projectSigns.length}</div><div className="sbp-kpi__label">Signs</div></div>
              <div className="lum-card"><div className="sbp-kpi__value">{totalUnits}</div><div className="sbp-kpi__label">Total Units</div></div>
              <div className="lum-card">
                <div className="sbp-kpi__value" style={{ fontSize: 18 }}>{new Date(active.createdAt).toLocaleDateString()}</div>
                <div className="sbp-kpi__label">Created</div>
              </div>
            </div>

            <div className="sbp-list">
              <div className="sbp-list__head">
                <span className="sbp-list__title">Signs in this project</span>
                <button
                  type="button"
                  className="lum-btn is-ghost"
                  style={{ padding: "4px 10px", fontSize: 11 }}
                  onClick={openNewSign}
                >
                  + Add Sign
                </button>
              </div>
              {projectSigns.length === 0 ? (
                <div className="sbp-list__empty">No signs in this project yet — start one with "+ Add Sign".</div>
              ) : (
                projectSigns.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="sbp-list__row"
                    onClick={() => openSign(s)}
                  >
                    <div className="sbp-list__row-main">
                      <span className="sbp-list__row-title">{s.name || s.productCode || "Untitled"}</span>
                      <span className="sbp-list__row-meta">
                        {s.signTypeCode || "—"} · Qty {s.quantity}{s.productCode ? ` · ${s.productCode}` : ""}
                      </span>
                    </div>
                    <div className="sbp-list__row-right">
                      <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                      <span className="sbp-list__chevron">›</span>
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
