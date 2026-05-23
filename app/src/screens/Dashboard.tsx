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
    return { totalSigns, projects, totalUnits };
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
    <main className="lum-page">
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

      <section className="sbp-kpis">
        <div className="lum-card">
          <div className="sbp-kpi__value">{stats.totalSigns}</div>
          <div className="sbp-kpi__label">Signs Built</div>
        </div>
        <div className="lum-card">
          <div className="sbp-kpi__value">{stats.projects}</div>
          <div className="sbp-kpi__label">Projects</div>
        </div>
        <div className="lum-card">
          <div className="sbp-kpi__value">{stats.totalUnits}</div>
          <div className="sbp-kpi__label">Total Units</div>
        </div>
      </section>

      <section className="sbp-twocol">
        <div className="sbp-list">
          <div className="sbp-list__head">
            <span className="sbp-list__title">Individual Signs</span>
            <button
              type="button"
              className="lum-btn is-ghost"
              style={{ padding: "4px 10px", fontSize: 11 }}
              onClick={() => { clearAll(); navigate("/builder"); }}
            >
              + New
            </button>
          </div>
          {loadingRecent ? (
            <div className="sbp-list__empty">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="sbp-list__empty">No signs yet — get started above.</div>
          ) : (
            recent.slice(0, 6).map((s) => {
              const t = getSignType(s.signTypeCode || "");
              return (
                <button
                  key={s.id}
                  type="button"
                  className="sbp-list__row"
                  onClick={() => { loadSpec(s); navigate("/builder"); }}
                >
                  <div className="sbp-list__row-main">
                    <span className="sbp-list__row-title">{s.projectName || s.productCode || "Untitled"}</span>
                    <span className="sbp-list__row-meta">
                      {t?.name ?? "—"} · Qty {s.quantity}
                    </span>
                  </div>
                  <div className="sbp-list__row-right">
                    {s.finish === "P" ? <Pill tone="green">Painted</Pill> : null}
                    {s.illumination === "IL" || s.illumination === "EL"
                      ? <Pill tone="amber">Lighted</Pill>
                      : null}
                    <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                    <span className="sbp-list__chevron">›</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="sbp-list">
          <div className="sbp-list__head">
            <span className="sbp-list__title">Projects</span>
          </div>
          {projects.length === 0 ? (
            <div className="sbp-list__empty">No projects yet.</div>
          ) : (
            projects.map(([name, info]) => (
              <div key={name} className="sbp-list__row" style={{ cursor: "default" }}>
                <div className="sbp-list__row-main">
                  <span className="sbp-list__row-title">{name}</span>
                  <span className="sbp-list__row-meta">
                    {info.count} sign{info.count === 1 ? "" : "s"} · {info.units} units
                  </span>
                </div>
                <div className="sbp-list__row-right">
                  <Pill tone="navy">{info.lastCode || "—"}</Pill>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
