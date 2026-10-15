import { useMemo } from "react";
import type { View } from "../components/Sidebar";
import { Progress, StatusPill, formatDate } from "../components/ui";
import { useSetupStore } from "../store/setup-store";
import { useSpecStore } from "../store/spec-store";

export default function Dashboard({
  onOpenSpec,
  onNewSpec,
  onNav,
  canEdit,
}: {
  onOpenSpec: (id: string) => void;
  onNewSpec: () => void;
  onNav: (v: View) => void;
  canEdit: boolean;
}) {
  const specs = useSpecStore((s) => s.specs);
  const lines = useSpecStore((s) => s.lines);
  const projects = useSpecStore((s) => s.projects);
  const idx = useSetupStore((s) => s.idx);

  const stats = useMemo(() => {
    const units = lines.reduce((n, l) => n + (l.quantity || 0), 0);
    return {
      signs: lines.length,
      specs: specs.length,
      units,
      approved: specs.filter((s) => s.status === "approved" || s.status === "built").length,
    };
  }, [specs, lines]);

  const recent = useMemo(() => [...specs].sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || "")).slice(0, 8), [specs]);

  const specPct = (specId: string) => {
    const ls = lines.filter((l) => l.specId === specId);
    if (ls.length === 0) return 0;
    return ls.reduce((n, l) => n + l.completedPct, 0) / ls.length;
  };

  return (
    <div className="sbp-page">
      <div className="sbp-hero">
        <div>
          <h1>Build. Spec. Deliver.</h1>
          <p>Spec each sign from the opportunity to the job — the descriptions write themselves.</p>
        </div>
        <div className="sbp-spacer" />
        {canEdit && (
          <button type="button" className="btn-primary" data-tour="new-spec" style={{ background: "var(--surface-raised)", color: "var(--accent-brand)" }} onClick={onNewSpec}>
            + New Spec
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => onNav("library")}>
          Sign Library
        </button>
      </div>

      <div className="sbp-kpis">
        <div className="sbp-kpi">
          <div className="sbp-caption">Signs Built</div>
          <div className="sbp-kpi__value">{stats.signs}</div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-caption">Specs</div>
          <div className="sbp-kpi__value">{stats.specs}</div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-caption">Total Units</div>
          <div className="sbp-kpi__value">{stats.units}</div>
        </div>
        <div className="sbp-kpi">
          <div className="sbp-caption">Approved</div>
          <div className="sbp-kpi__value">{stats.approved}</div>
        </div>
      </div>

      <div className="sbp-two-col">
        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 8 }}>
            <div className="sbp-caption">Recent Specs</div>
            <div className="sbp-spacer" />
            <button type="button" className="btn-secondary" onClick={() => onNav("builder")}>
              Open Builder
            </button>
          </div>
          {recent.length === 0 && <div className="sbp-muted">No specs yet. Start one with + New Spec.</div>}
          {recent.map((s) => {
            const signCount = lines.filter((l) => l.specId === s.id).length;
            return (
              <div key={s.id} className="sbp-list-item" onClick={() => onOpenSpec(s.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    {s.number} · {s.customerName || s.description || "No customer yet"}
                  </div>
                  <div className="sbp-muted" style={{ fontSize: 12 }}>
                    {[s.opportunityNo && `Opp ${s.opportunityNo}`, s.jobNo && `Job ${s.jobNo}`, `${signCount} sign${signCount === 1 ? "" : "s"}`, formatDate(s.modifiedAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <Progress pct={specPct(s.id)} />
                <StatusPill status={s.status} />
              </div>
            );
          })}
        </div>

        <div className="sbp-card">
          <div className="sbp-row" style={{ marginBottom: 8 }}>
            <div className="sbp-caption">Projects</div>
            <div className="sbp-spacer" />
            <button type="button" className="btn-secondary" onClick={() => onNav("projects")}>
              All Projects
            </button>
          </div>
          {projects.length === 0 && <div className="sbp-muted">No projects yet.</div>}
          {projects.slice(0, 8).map((p) => (
            <div key={p.id} className="sbp-list-item" onClick={() => onNav("projects")}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="sbp-muted" style={{ fontSize: 12 }}>
                  {p.customerName} · {specs.filter((s) => s.projectId === p.id).length} specs
                </div>
              </div>
            </div>
          ))}
          {idx && (
            <div className="sbp-muted" style={{ fontSize: 12, marginTop: 10 }}>
              Setup: {idx.activeCategories().length} categories · {idx.data.signTypes.filter((t) => !t.isBlock).length} sign types · {idx.data.questions.length} questions
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
