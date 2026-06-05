import { useState } from "react";
import type { Role } from "../types";
import { kpisByRole, safetyMetric, upcomingTargets } from "../data/mockData";

/* ============ Shared dashboard data ============ */

export const DEPT_WORKLOAD = [
  { name: "Vinyl Cut / Apply", count: 36, pct: 45.0, color: "green" },
  { name: "Assembly",          count: 16, pct: 20.0, color: "red" },
  { name: "Metal Fab",         count: 8,  pct: 10.0, color: "navy" },
  { name: "Routing",           count: 7,  pct: 8.8,  color: "amber" },
  { name: "Paint",             count: 5,  pct: 6.3,  color: "blue" },
  { name: "Material Cut",      count: 4,  pct: 5.0,  color: "violet" },
  { name: "Vinyl Install",     count: 4,  pct: 5.0,  color: "pink" },
] as const;
export const TOTAL_PROJECTS = DEPT_WORKLOAD.reduce((s, d) => s + d.count, 0);

export interface KanbanTask {
  id: string;
  priority: "High" | "Medium" | "Low";
  customer: string;
  scope: string;
  due: string;
  progress: number;
}
export const KANBAN: Record<string, KanbanTask[]> = {
  "To Do": [
    { id: "k1", priority: "High",   customer: "Westfield Mall",    scope: "Monument cabinet frame — fab",  due: "Tue Jun 9",  progress: 0  },
    { id: "k2", priority: "Medium", customer: "Route 9 pylons",    scope: "Pylon refurb — strip & re-skin",due: "Mon Jun 15", progress: 0  },
    { id: "k3", priority: "Medium", customer: "UConn — wayfinding",scope: "Cabinet runs (batch 2)",        due: "Tue Jun 23", progress: 0  },
  ],
  "In Progress": [
    { id: "k4", priority: "High",   customer: "Hartford Med Ctr",  scope: "Channel letters — fab complete",due: "Fri Jun 5",  progress: 58 },
    { id: "k5", priority: "Medium", customer: "Sunoco — Route 9",  scope: "LED retrofit — bracket weld",   due: "Wed Jun 10", progress: 24 },
  ],
  "Review": [
    { id: "k6", priority: "Medium", customer: "Stop & Shop",       scope: "Cabinet sign — paint + QA",     due: "Sat Jun 20", progress: 86 },
  ],
  "Completed": [
    { id: "k7", priority: "Low",    customer: "Dunkin' franchise", scope: "Window vinyl — print + weed",   due: "Thu Jun 18", progress: 100 },
  ],
};

export type KpiVm = {
  key: string;
  label: string;
  value: number;
  valueFormat: "currency" | "int" | "hours" | "percent" | "text";
  textValue?: string;
  goal?: string;
  delta?: number;
  deltaDirection?: "up" | "down" | "flat";
  deltaIsGood?: boolean;
};

export function getKpiList(role: Role): KpiVm[] {
  const safety: KpiVm = {
    key: "safety",
    label: "Days Since Lost Time",
    value: safetyMetric.currentStreakDays,
    valueFormat: "int",
    goal: "> 365 days",
  };
  return [safety, ...kpisByRole[role]] as KpiVm[];
}

export function formatValue(value: number, fmt: string, textValue?: string): string {
  if (fmt === "text") return textValue ?? "—";
  if (fmt === "currency") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (fmt === "percent") return value + "%";
  if (fmt === "hours") return value.toLocaleString() + "h";
  return value.toLocaleString();
}

/* ============ Reusable card body renderers ============ */

export function KpiCardBody({ k }: { k: KpiVm }) {
  const showDelta = !!k.deltaDirection && k.valueFormat !== "text" && k.delta != null;
  const arrow =
    k.deltaDirection === "up" ? "▲" : k.deltaDirection === "down" ? "▼" : "▬";
  const cls =
    k.deltaDirection === "flat" ? "is-flat" : k.deltaIsGood ? "is-good" : "is-bad";
  return (
    <div className="dm-kpi-body">
      <div className="dm-kpi__label">{k.label}</div>
      <div className={`dm-kpi__value ${k.valueFormat === "text" ? "is-text" : ""}`}>
        {formatValue(k.value, k.valueFormat, k.textValue)}
      </div>
      <div className="dm-kpi__foot">
        {k.goal && <span className="dm-kpi__goal">Goal {k.goal}</span>}
        {showDelta && (
          <span className={`dm-kpi__delta ${cls}`}>
            {arrow} {k.delta}{k.valueFormat === "percent" ? "pp" : "%"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Donut chart card body. `stackLegend` puts the legend underneath the
 *  donut instead of beside it — used for narrow / landscape-mobile layouts.
 */
export function DonutBody({ stackLegend = false }: { stackLegend?: boolean } = {}) {
  const C = 2 * Math.PI * 70;
  let cum = 0;
  return (
    <div className="dm-card-body dm-donut-body">
      <div className={`dm-donut__wrap ${stackLegend ? "is-stacked" : ""}`}>
        <svg viewBox="0 0 200 200" className="dm-donut__svg">
          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--dm-border-soft)" strokeWidth="28" />
          {DEPT_WORKLOAD.map((d) => {
            const dash = (d.pct / 100) * C;
            const offset = -((cum / 100) * C);
            cum += d.pct;
            return (
              <circle
                key={d.name}
                cx="100" cy="100" r="70"
                fill="none"
                stroke={`var(--dm-swatch-${d.color})`}
                strokeWidth="28"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
                transform="rotate(-90 100 100)"
              />
            );
          })}
          <text x="100" y="92" className="dm-donut__total" textAnchor="middle">{TOTAL_PROJECTS}</text>
          <text x="100" y="112" className="dm-donut__totalLabel" textAnchor="middle">Active Projects</text>
        </svg>
        <ul className="dm-donut__legend">
          {DEPT_WORKLOAD.map((d) => (
            <li key={d.name} className="dm-donut__row">
              <span className="dm-donut__swatch" style={{ background: `var(--dm-swatch-${d.color})` }} />
              <span className="dm-donut__name">{d.name}</span>
              <span className="dm-donut__qty">{d.count} <span className="dm-donut__qtysep">·</span> {d.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Targets card body with built-in Production / Installation toggle. */
export function TargetsBody({
  showToggle = true,
  limit,
}: { showToggle?: boolean; limit?: number } = {}) {
  const [dept, setDept] = useState<"Production" | "Installation">("Production");
  const filtered = upcomingTargets
    .filter((t) => t.dept === dept)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const rows = typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  const tone = (s: string) => (s === "On track" ? "green" : s === "At risk" ? "amber" : "red");
  return (
    <div className="dm-card-body">
      {showToggle && (
        <div className="dm-pill-toggle dm-pill-toggle--inline">
          {(["Production", "Installation"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`dm-pill-toggle__btn ${dept === d ? "is-active" : ""}`}
              onClick={() => setDept(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      <ul className="dm-targets__list">
        {rows.map((t) => (
          <li key={t.id} className="dm-targets__row">
            <div className="dm-targets__when">
              <div className="dm-targets__date">{t.targetDateLabel}</div>
              <div className="dm-targets__until">{t.daysUntil} d</div>
            </div>
            <div className="dm-targets__body">
              <div className="dm-targets__customer">{t.customer}</div>
              <div className="dm-targets__scope">{t.jobNumber} · {t.scope}</div>
            </div>
            <span className={`dm-pill dm-pill--${tone(t.status)}`}>{t.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kanban card body with Kanban / List view toggle. */
export function KanbanBody({ showToggle = true }: { showToggle?: boolean } = {}) {
  const [mode, setMode] = useState<"Kanban" | "List">("Kanban");
  const tone = (p: KanbanTask["priority"]) =>
    p === "High" ? "red" : p === "Medium" ? "amber" : "navy";

  return (
    <div className="dm-card-body">
      {showToggle && (
        <div className="dm-pill-toggle dm-pill-toggle--inline">
          {(["Kanban", "List"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`dm-pill-toggle__btn ${mode === m ? "is-active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {mode === "Kanban" ? (
        <div className="dm-kanban__cols">
          {Object.entries(KANBAN).map(([col, tasks]) => (
            <div key={col} className="dm-kanban__col">
              <div className="dm-kanban__colhead">
                <span className="dm-kanban__coldot" data-col={col} />
                <span className="dm-kanban__colname">{col}</span>
                <span className="dm-kanban__colcount">{tasks.length}</span>
              </div>
              {tasks.map((t) => (
                <article key={t.id} className="dm-kanban__task">
                  <span className={`dm-pill dm-pill--${tone(t.priority)} dm-pill--xs`}>{t.priority}</span>
                  <div className="dm-kanban__task-title">{t.customer}</div>
                  <div className="dm-kanban__task-scope">{t.scope}</div>
                  <div className="dm-kanban__task-foot">
                    <span>{t.due}</span>
                    <span>{t.progress}%</span>
                  </div>
                  <div className="dm-kanban__bar">
                    <div className="dm-kanban__bar-fill" data-col={col} style={{ width: `${t.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <ul className="dm-kanban-list">
          {Object.entries(KANBAN).flatMap(([col, tasks]) =>
            tasks.map((t) => (
              <li key={t.id} className="dm-kanban-list__row" data-col={col}>
                <span className={`dm-pill dm-pill--${tone(t.priority)} dm-pill--xs`}>{t.priority}</span>
                <div className="dm-kanban-list__body">
                  <div className="dm-kanban-list__title">{t.customer}</div>
                  <div className="dm-kanban-list__scope">{t.scope}</div>
                </div>
                <div className="dm-kanban-list__right">
                  <span className="dm-kanban-list__col">{col}</span>
                  <span className="dm-kanban-list__when">{t.due} · {t.progress}%</span>
                </div>
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
