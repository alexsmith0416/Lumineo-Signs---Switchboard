// Dashboard — aligned with docs/DESIGN.md Switchboard pattern:
// KPI strip (horizontal scroll) + two-column row of panels. The hero block
// stays for the launch CTAs but uses the indigo gradient from the design
// system.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSpec } from "../app/SpecContext";
import { Pill } from "../ui/Pill";
import { statusTone } from "../ui/specStatus";
import { getSignType } from "../domain/signTypes";

export function Dashboard() {
  const navigate = useNavigate();
  const { recent, loadingRecent, clearAll, loadSpec } = useSpec();

  const stats = useMemo(() => {
    const totalSigns = recent.length;
    const projects = new Set(recent.map((s) => s.projectName).filter(Boolean)).size;
    const totalUnits = recent.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
    const approved = recent.filter((s) => s.status === "Approved").length;
    return { totalSigns, projects, totalUnits, approved };
  }, [recent]);

  const projects = useMemo(() => {
    const m = new Map<string, { count: number; units: number; lastCode: string }>();
    for (const s of recent) {
      if (!s.projectName) continue;
      const cur = m.get(s.projectName) ?? { count: 0, units: 0, lastCode: s.productCode };
      cur.count += 1;
      cur.units += Number(s.quantity) || 0;
      m.set(s.projectName, cur);
    }
    return Array.from(m.entries()).slice(0, 5);
  }, [recent]);

  return (
    <>
      <section className="sbp-hero">
        <div className="sbp-hero__eyebrow">Sign Builder Pro</div>
        <h1 className="sbp-hero__title">Build. Spec. Deliver.</h1>
        <p className="sbp-hero__subtitle">
          Configure commercial sign specs for individual orders or full projects — fast.
        </p>
        <div className="sbp-hero__ctas">
          <button
            type="button"
            className="sbp-hero__cta is-red"
            onClick={() => { clearAll(); navigate("/builder"); }}
          >
            🪧 New Individual Sign
          </button>
          <button
            type="button"
            className="sbp-hero__cta is-outline"
            onClick={() => navigate("/projects")}
          >
            📁 New Project
          </button>
        </div>
      </section>

      <section className="sbp-kpi-strip">
        <div className="sbp-kpi">
          <div className="sbp-kpi__label">Signs Built</div>
          <div className="sbp-kpi__value lum-num">{stats.totalSigns}</div>
          <div className="sbp-kpi__footer">
            <span className="sbp-kpi__goal">Total saved specs</span>
          </div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-kpi__label">Projects</div>
          <div className="sbp-kpi__value lum-num">{stats.projects}</div>
          <div className="sbp-kpi__footer">
            <span className="sbp-kpi__goal">Active projects</span>
          </div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-kpi__label">Total Units</div>
          <div className="sbp-kpi__value lum-num">{stats.totalUnits}</div>
          <div className="sbp-kpi__footer">
            <span className="sbp-kpi__goal">Across all specs</span>
          </div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-kpi__label">Approved</div>
          <div className="sbp-kpi__value lum-num">{stats.approved}</div>
          <div className="sbp-kpi__footer">
            <span className="sbp-kpi__goal">Ready for production</span>
          </div>
        </div>
      </section>

      <section className="sbp-twocol">
        <div className="lum-panel">
          <div className="lum-panel__head">
            <span>Individual Signs</span>
            <button
              type="button"
              className="lum-btn"
              style={{ padding: "5px 12px", fontSize: 11 }}
              onClick={() => { clearAll(); navigate("/builder"); }}
            >
              + New
            </button>
          </div>
          {loadingRecent ? (
            <div className="sbp-list-empty">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="sbp-list-empty">No signs yet — get started above.</div>
          ) : (
            recent.slice(0, 6).map((s) => {
              const t = getSignType(s.signTypeCode || "");
              return (
                <button
                  key={s.id}
                  type="button"
                  className="sbp-list-row"
                  onClick={() => { loadSpec(s); navigate("/builder"); }}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: "1px solid var(--border-soft)" }}
                >
                  <div className="sbp-list-row__main">
                    <span className="sbp-list-row__title">{s.name || s.projectName || s.productCode || "Untitled"}</span>
                    <span className="sbp-list-row__sub">{t?.name ?? "—"} · Qty {s.quantity}</span>
                  </div>
                  <div className="sbp-list-row__right">
                    {s.finish === "P" ? <Pill tone="green">Painted</Pill> : null}
                    {s.illumination === "IL" || s.illumination === "EL"
                      ? <Pill tone="amber">Lighted</Pill>
                      : null}
                    <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lum-panel">
          <div className="lum-panel__head">
            <span>Projects</span>
          </div>
          {projects.length === 0 ? (
            <div className="sbp-list-empty">No projects yet.</div>
          ) : (
            projects.map(([name, info]) => (
              <div key={name} className="sbp-list-row" style={{ cursor: "default" }}>
                <div className="sbp-list-row__main">
                  <span className="sbp-list-row__title">{name}</span>
                  <span className="sbp-list-row__sub">
                    {info.count} sign{info.count === 1 ? "" : "s"} · {info.units} units
                  </span>
                </div>
                <div className="sbp-list-row__right">
                  <Pill tone="navy">{info.lastCode || "—"}</Pill>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
