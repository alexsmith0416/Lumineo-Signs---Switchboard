import { useState } from "react";
import type { Role } from "../types";
import {
  kpisByRole,
  safetyMetric,
  upcomingTargets,
  usersByRole,
} from "../data/mockData";

interface Props {
  role: Role;
  onBack: () => void;
}

type Theme = "light" | "dark";

const DEPT_WORKLOAD = [
  { name: "Vinyl Cut / Apply", count: 36, pct: 45.0, color: "green" },
  { name: "Assembly",          count: 16, pct: 20.0, color: "red" },
  { name: "Metal Fab",         count: 8,  pct: 10.0, color: "navy" },
  { name: "Routing",           count: 7,  pct: 8.8,  color: "amber" },
  { name: "Paint",             count: 5,  pct: 6.3,  color: "blue" },
  { name: "Material Cut",      count: 4,  pct: 5.0,  color: "violet" },
  { name: "Vinyl Install",     count: 4,  pct: 5.0,  color: "pink" },
] as const;

const TOTAL_PROJECTS = DEPT_WORKLOAD.reduce((s, d) => s + d.count, 0);

const SIDEBAR_MAIN = [
  { key: "dash",    icon: "▦", label: "Dashboard", active: true },
  { key: "sched",   icon: "▤", label: "My Schedule" },
  { key: "inbox",   icon: "✉", label: "Inbox", badge: 4 },
  { key: "cal",     icon: "▢", label: "Calendar" },
];

const SIDEBAR_APPS = [
  { key: "ps", icon: "📊", label: "Project Scheduler", badge: 17 },
  { key: "ws", icon: "🗓️", label: "Weekly Scheduler",  badge: 23 },
  { key: "sb", icon: "✏️", label: "Sign Builder Pro" },
  { key: "tp", icon: "📷", label: "Time & Photo" },
  { key: "es", icon: "🧮", label: "Estimating",         badge: 6 },
  { key: "sh", icon: "💰", label: "Sales Hub",          badge: 11 },
];

const SIDEBAR_OTHER = [
  { key: "set",  icon: "⚙", label: "Settings" },
  { key: "help", icon: "❓", label: "Help" },
];

const KANBAN: Record<string, KanbanTask[]> = {
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

interface KanbanTask {
  id: string;
  priority: "High" | "Medium" | "Low";
  customer: string;
  scope: string;
  due: string;
  progress: number;
}

function formatValue(value: number, fmt: string, textValue?: string): string {
  if (fmt === "text") return textValue ?? "—";
  if (fmt === "currency") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (fmt === "percent") return value + "%";
  if (fmt === "hours") return value.toLocaleString() + "h";
  return value.toLocaleString();
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <button
      type="button"
      className="dm-theme-toggle"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      onClick={() => onChange(theme === "light" ? "dark" : "light")}
    >
      <span className="dm-theme-toggle__icon">{theme === "light" ? "🌙" : "☀️"}</span>
      <span className="dm-theme-toggle__label">{theme === "light" ? "Dark" : "Light"}</span>
    </button>
  );
}

function DonutChart() {
  const C = 2 * Math.PI * 70; // circumference
  let cumPct = 0;
  return (
    <svg viewBox="0 0 200 200" className="dm-donut__svg" role="img" aria-label="Production department workloads">
      <circle cx="100" cy="100" r="70" fill="none" stroke="var(--dm-border-soft)" strokeWidth="28" />
      {DEPT_WORKLOAD.map((d) => {
        const dash = (d.pct / 100) * C;
        const gap  = C - dash;
        const offset = -((cumPct / 100) * C);
        cumPct += d.pct;
        return (
          <circle
            key={d.name}
            cx="100" cy="100" r="70"
            fill="none"
            stroke={`var(--dm-swatch-${d.color})`}
            strokeWidth="28"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        );
      })}
      <text x="100" y="92" className="dm-donut__total" textAnchor="middle">{TOTAL_PROJECTS}</text>
      <text x="100" y="112" className="dm-donut__totalLabel" textAnchor="middle">Active Projects</text>
    </svg>
  );
}

function priorityTone(p: KanbanTask["priority"]): string {
  return p === "High" ? "red" : p === "Medium" ? "amber" : "navy";
}

function statusTone(s: string): string {
  return s === "On track" ? "green" : s === "At risk" ? "amber" : "red";
}

export default function DashboardMockup({ role, onBack }: Props) {
  const [theme, setTheme] = useState<Theme>("light");
  const user = usersByRole[role];
  const kpis = kpisByRole[role];

  // 8 cards: 1 safety + the 7 most informative KPIs for Operations
  // Trim to 8 for a clean 4-up grid x 2 rows.
  const safetyKpi = {
    key: "safety",
    label: "Days Since Lost Time",
    value: safetyMetric.currentStreakDays,
    valueFormat: "int" as const,
    textValue: undefined,
    goal: "> 365 days",
    delta: 0,
    deltaDirection: "down" as const,
    deltaIsGood: false,
  };
  const displayKpis: Array<{
    key: string;
    label: string;
    value: number;
    valueFormat: string;
    textValue?: string;
    goal?: string;
    delta?: number;
    deltaDirection?: "up" | "down" | "flat";
    deltaIsGood?: boolean;
  }> = [safetyKpi, ...kpis.slice(0, 7)];

  const targetsThisWeek = upcomingTargets
    .filter((t) => t.dept === "Production")
    .slice(0, 6);

  return (
    <div className="dm-root" data-theme={theme}>
      {/* Sidebar */}
      <aside className="dm-sidebar">
        <div className="dm-sidebar__brand">
          <div className="dm-sidebar__logo">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <path
                fill="var(--dm-red)"
                fillRule="evenodd"
                d="M0,0 H100 V100 H0 Z
                   M25,75 L22,0 L28,0 Z
                   M25,75 L34,0 L46,0 Z
                   M25,75 L54,0 L70,0 Z
                   M25,75 L82,0 L100,7 L100,0 Z
                   M25,75 L100,18 L100,40 Z
                   M25,75 L100,52 L100,76 Z"
              />
            </svg>
          </div>
          <div className="dm-sidebar__brandtext">
            <div className="dm-sidebar__brandname">LUMINEO</div>
            <div className="dm-sidebar__brandsub">SWITCHBOARD</div>
          </div>
        </div>

        <div className="dm-sidebar__section">Main</div>
        <ul className="dm-sidebar__list">
          {SIDEBAR_MAIN.map((it) => (
            <li key={it.key}>
              <button className={`dm-sidebar__item ${it.active ? "is-active" : ""}`}>
                <span className="dm-sidebar__icon">{it.icon}</span>
                <span className="dm-sidebar__label">{it.label}</span>
                {it.badge && <span className="dm-sidebar__badge">{it.badge}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="dm-sidebar__section">Apps</div>
        <ul className="dm-sidebar__list">
          {SIDEBAR_APPS.map((it) => (
            <li key={it.key}>
              <button className="dm-sidebar__item">
                <span className="dm-sidebar__icon">{it.icon}</span>
                <span className="dm-sidebar__label">{it.label}</span>
                {it.badge && <span className="dm-sidebar__badge">{it.badge}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="dm-sidebar__section">Other</div>
        <ul className="dm-sidebar__list">
          {SIDEBAR_OTHER.map((it) => (
            <li key={it.key}>
              <button className="dm-sidebar__item">
                <span className="dm-sidebar__icon">{it.icon}</span>
                <span className="dm-sidebar__label">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main column */}
      <main className="dm-main">
        <header className="dm-topbar">
          <div>
            <div className="dm-topbar__crumb">Switchboard · Dashboard</div>
            <h1 className="dm-topbar__title">Hi {user.name.split(" ")[0]}, here's your day</h1>
          </div>
          <div className="dm-topbar__actions">
            <div className="dm-search">
              <span className="dm-search__icon">⌕</span>
              <span className="dm-search__placeholder">Search jobs, customers, people…</span>
            </div>
            <ThemeToggle theme={theme} onChange={setTheme} />
            <button type="button" className="dm-back" onClick={onBack}>← Splash</button>
            <div className="dm-user">
              <div className="dm-user__avatar">{user.initials}</div>
              <div className="dm-user__block">
                <div className="dm-user__name">{user.name}</div>
                <div className="dm-user__role">{role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* KPI grid */}
        <section className="dm-kpis">
          {displayKpis.map((k) => {
            const dirArrow =
              k.deltaDirection === "up" ? "▲" :
              k.deltaDirection === "down" ? "▼" : "▬";
            const dirCls =
              k.deltaDirection === "flat" ? "is-flat" :
              k.deltaIsGood ? "is-good" : "is-bad";
            const showDelta = !!k.deltaDirection && k.valueFormat !== "text" && k.delta != null;
            return (
              <article key={k.key} className="dm-kpi">
                <div className="dm-kpi__label">{k.label}</div>
                <div className={`dm-kpi__value ${k.valueFormat === "text" ? "is-text" : ""}`}>
                  {formatValue(k.value, k.valueFormat, k.textValue)}
                </div>
                <div className="dm-kpi__foot">
                  {k.goal && <span className="dm-kpi__goal">Goal {k.goal}</span>}
                  {showDelta && (
                    <span className={`dm-kpi__delta ${dirCls}`}>
                      {dirArrow} {k.delta}{k.valueFormat === "percent" ? "pp" : "%"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Middle row — donut + targets */}
        <section className="dm-mid">
          <article className="dm-card dm-donut">
            <header className="dm-card__head">
              <div>
                <h3 className="dm-card__title">Production Department Workloads</h3>
                <div className="dm-card__sub">All open projects by department</div>
              </div>
              <button className="dm-card__action">View report</button>
            </header>
            <div className="dm-donut__wrap">
              <DonutChart />
              <ul className="dm-donut__legend">
                {DEPT_WORKLOAD.map((d) => (
                  <li key={d.name} className="dm-donut__row">
                    <span
                      className="dm-donut__swatch"
                      style={{ background: `var(--dm-swatch-${d.color})` }}
                    />
                    <span className="dm-donut__name">{d.name}</span>
                    <span className="dm-donut__qty">
                      {d.count} <span className="dm-donut__qtysep">·</span> {d.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="dm-card dm-targets">
            <header className="dm-card__head">
              <div>
                <h3 className="dm-card__title">Upcoming Target Dates</h3>
                <div className="dm-card__sub">3-week look-ahead · Production</div>
              </div>
              <div className="dm-pill-toggle">
                <button className="dm-pill-toggle__btn is-active">Production</button>
                <button className="dm-pill-toggle__btn">Installation</button>
              </div>
            </header>
            <ul className="dm-targets__list">
              {targetsThisWeek.map((t) => (
                <li key={t.id} className="dm-targets__row">
                  <div className="dm-targets__when">
                    <div className="dm-targets__date">{t.targetDateLabel}</div>
                    <div className="dm-targets__until">
                      {t.daysUntil <= 1 ? (t.daysUntil === 0 ? "Today" : "Tomorrow") : `${t.daysUntil} d`}
                    </div>
                  </div>
                  <div className="dm-targets__body">
                    <div className="dm-targets__customer">{t.customer}</div>
                    <div className="dm-targets__scope">{t.jobNumber} · {t.scope}</div>
                  </div>
                  <span className={`dm-pill dm-pill--${statusTone(t.status)}`}>{t.status}</span>
                </li>
              ))}
            </ul>
          </article>
        </section>

        {/* Kanban row */}
        <section className="dm-card dm-kanban">
          <header className="dm-card__head">
            <div>
              <h3 className="dm-card__title">Production Board</h3>
              <div className="dm-card__sub">Department flow this week</div>
            </div>
            <div className="dm-pill-toggle">
              <button className="dm-pill-toggle__btn is-active">Kanban</button>
              <button className="dm-pill-toggle__btn">Calendar</button>
              <button className="dm-pill-toggle__btn">List</button>
            </div>
          </header>

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
                    <span className={`dm-pill dm-pill--${priorityTone(t.priority)} dm-pill--xs`}>
                      {t.priority}
                    </span>
                    <div className="dm-kanban__task-title">{t.customer}</div>
                    <div className="dm-kanban__task-scope">{t.scope}</div>
                    <div className="dm-kanban__task-foot">
                      <span className="dm-kanban__task-when">{t.due}</span>
                      <span className="dm-kanban__task-pct">{t.progress}%</span>
                    </div>
                    <div className="dm-kanban__bar">
                      <div
                        className="dm-kanban__bar-fill"
                        data-col={col}
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
