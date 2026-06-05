import { useEffect, useMemo, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Role } from "../types";
import {
  kpisByRole,
  safetyMetric,
  upcomingTargets,
  usersByRole,
} from "../data/mockData";

const Grid = WidthProvider(GridLayout);

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
  { key: "dash",  icon: "▦", label: "Dashboard", active: true },
  { key: "sched", icon: "▤", label: "My Schedule" },
  { key: "inbox", icon: "✉", label: "Inbox", badge: 4 },
  { key: "cal",   icon: "▢", label: "Calendar" },
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

interface KanbanTask {
  id: string;
  priority: "High" | "Medium" | "Low";
  customer: string;
  scope: string;
  due: string;
  progress: number;
}
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

function formatValue(value: number, fmt: string, textValue?: string): string {
  if (fmt === "text") return textValue ?? "—";
  if (fmt === "currency") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (fmt === "percent") return value + "%";
  if (fmt === "hours") return value.toLocaleString() + "h";
  return value.toLocaleString();
}

/* ---------- Card renderers ---------- */

function KpiCardBody({ k }: { k: ReturnType<typeof getKpiList>[number] }) {
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

function DonutBody() {
  const C = 2 * Math.PI * 70;
  let cum = 0;
  return (
    <div className="dm-card-body dm-donut-body">
      <div className="dm-donut__wrap">
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

function TargetsBody() {
  const rows = upcomingTargets.filter((t) => t.dept === "Production").slice(0, 6);
  const tone = (s: string) => (s === "On track" ? "green" : s === "At risk" ? "amber" : "red");
  return (
    <div className="dm-card-body">
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

function KanbanBody() {
  const tone = (p: KanbanTask["priority"]) =>
    p === "High" ? "red" : p === "Medium" ? "amber" : "navy";
  return (
    <div className="dm-card-body">
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
    </div>
  );
}

/* ---------- Card catalog ---------- */

type CardId =
  | `kpi:${string}`
  | "donut"
  | "targets"
  | "kanban";

function getKpiList(role: Role) {
  const list = kpisByRole[role];
  const safety = {
    key: "safety",
    label: "Days Since Lost Time",
    value: safetyMetric.currentStreakDays,
    valueFormat: "int" as const,
    textValue: undefined as string | undefined,
    goal: "> 365 days",
    delta: undefined,
    deltaDirection: undefined,
    deltaIsGood: undefined,
  };
  return [safety, ...list] as Array<{
    key: string;
    label: string;
    value: number;
    valueFormat: "currency" | "int" | "hours" | "percent" | "text";
    textValue?: string;
    goal?: string;
    delta?: number;
    deltaDirection?: "up" | "down" | "flat";
    deltaIsGood?: boolean;
  }>;
}

interface CardDef {
  id: CardId;
  title: string;
  category: "KPI" | "Chart" | "List" | "Board";
  default: { w: number; h: number };
  min: { w: number; h: number };
}

function buildCatalog(role: Role): CardDef[] {
  const kpis = getKpiList(role);
  const kpiCards: CardDef[] = kpis.map((k) => ({
    id: `kpi:${k.key}`,
    title: k.label,
    category: "KPI",
    default: { w: 3, h: 2 },
    min: { w: 2, h: 2 },
  }));
  return [
    ...kpiCards,
    { id: "donut",   title: "Production Department Workloads", category: "Chart", default: { w: 6, h: 5 }, min: { w: 4, h: 4 } },
    { id: "targets", title: "Upcoming Target Dates",            category: "List",  default: { w: 6, h: 5 }, min: { w: 4, h: 4 } },
    { id: "kanban",  title: "Production Board (Kanban)",        category: "Board", default: { w: 12, h: 6 }, min: { w: 6, h: 5 } },
  ];
}

/* ---------- Layout persistence ---------- */

type Item = { i: string; x: number; y: number; w: number; h: number; minW: number; minH: number };

function defaultLayout(role: Role): Item[] {
  const kpis = getKpiList(role).slice(0, 8);
  const items: Item[] = [];
  // Row 1 (y=0) — first 4 KPIs across, each 3w × 2h
  kpis.slice(0, 4).forEach((k, i) => {
    items.push({ i: `kpi:${k.key}`, x: i * 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 });
  });
  // Row 2 (y=2) — next 4 KPIs across
  kpis.slice(4, 8).forEach((k, i) => {
    items.push({ i: `kpi:${k.key}`, x: i * 3, y: 2, w: 3, h: 2, minW: 2, minH: 2 });
  });
  // Donut + Targets side-by-side at y=4
  items.push({ i: "donut",   x: 0, y: 4, w: 6, h: 5, minW: 4, minH: 4 });
  items.push({ i: "targets", x: 6, y: 4, w: 6, h: 5, minW: 4, minH: 4 });
  // Kanban full-width at y=9
  items.push({ i: "kanban", x: 0, y: 9, w: 12, h: 6, minW: 6, minH: 5 });
  return items;
}

const LS_KEY = (role: Role) => `dm-layout-v1-${role}`;

function loadLayout(role: Role): Item[] {
  try {
    const raw = localStorage.getItem(LS_KEY(role));
    if (!raw) return defaultLayout(role);
    const parsed = JSON.parse(raw) as Item[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultLayout(role);
    return parsed;
  } catch {
    return defaultLayout(role);
  }
}

function saveLayout(role: Role, items: Item[]) {
  try {
    localStorage.setItem(LS_KEY(role), JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/* ---------- Card renderer dispatch ---------- */

function CardContent({ id, role }: { id: string; role: Role }) {
  if (id.startsWith("kpi:")) {
    const k = getKpiList(role).find((x) => `kpi:${x.key}` === id);
    if (!k) return <div className="dm-card-body">Missing KPI</div>;
    return <KpiCardBody k={k} />;
  }
  if (id === "donut")   return <DonutBody />;
  if (id === "targets") return <TargetsBody />;
  if (id === "kanban")  return <KanbanBody />;
  return null;
}

function cardTitleFor(id: string, role: Role): string {
  if (id.startsWith("kpi:")) {
    const k = getKpiList(role).find((x) => `kpi:${x.key}` === id);
    return k?.label ?? id;
  }
  if (id === "donut")   return "Production Department Workloads";
  if (id === "targets") return "Upcoming Target Dates";
  if (id === "kanban")  return "Production Board";
  return id;
}

/* ---------- Main component ---------- */

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <button
      type="button"
      className="dm-theme-toggle"
      onClick={() => onChange(theme === "light" ? "dark" : "light")}
    >
      <span className="dm-theme-toggle__icon">{theme === "light" ? "🌙" : "☀️"}</span>
      <span className="dm-theme-toggle__label">{theme === "light" ? "Dark" : "Light"}</span>
    </button>
  );
}

export default function DashboardCustomizable({ role, onBack }: Props) {
  const [theme, setTheme] = useState<Theme>("light");
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layout, setLayout] = useState<Item[]>(() => loadLayout(role));
  const user = usersByRole[role];
  const catalog = useMemo(() => buildCatalog(role), [role]);

  // Reload layout if role changes
  useEffect(() => {
    setLayout(loadLayout(role));
  }, [role]);

  // Persist on layout change
  useEffect(() => {
    saveLayout(role, layout);
  }, [role, layout]);

  const activeIds = new Set(layout.map((i) => i.i));
  const available = catalog.filter((c) => !activeIds.has(c.id));

  function handleLayoutChange(next: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) {
    // Preserve minW/minH on each item
    const byKey = new Map(layout.map((i) => [i.i, i]));
    const merged: Item[] = next.map((n) => {
      const prev = byKey.get(n.i);
      return {
        i: n.i,
        x: n.x, y: n.y, w: n.w, h: n.h,
        minW: prev?.minW ?? 2,
        minH: prev?.minH ?? 2,
      };
    });
    setLayout(merged);
  }

  function addCard(def: CardDef) {
    // Stack at the bottom of current layout
    const maxY = layout.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setLayout([
      ...layout,
      {
        i: def.id,
        x: 0, y: maxY,
        w: def.default.w, h: def.default.h,
        minW: def.min.w, minH: def.min.h,
      },
    ]);
  }

  function removeCard(id: string) {
    setLayout(layout.filter((it) => it.i !== id));
  }

  function resetLayout() {
    if (confirm("Reset dashboard to the default layout?")) {
      const def = defaultLayout(role);
      setLayout(def);
    }
  }

  return (
    <div className="dm-root dm-root--custom" data-theme={theme}>
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
          <div>
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
            {editMode ? (
              <>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--add"
                  onClick={() => setDrawerOpen(true)}
                >
                  + Add card
                </button>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--reset"
                  onClick={resetLayout}
                  title="Reset to default"
                >
                  ↺ Reset
                </button>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--done"
                  onClick={() => { setEditMode(false); setDrawerOpen(false); }}
                >
                  ✓ Done
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dm-edit-btn"
                onClick={() => setEditMode(true)}
              >
                ✎ Edit dashboard
              </button>
            )}
            <button type="button" className="dm-back" onClick={onBack}>← Splash</button>
            <div className="dm-user">
              <div className="dm-user__avatar">{user.initials}</div>
              <div>
                <div className="dm-user__name">{user.name}</div>
                <div className="dm-user__role">{role}</div>
              </div>
            </div>
          </div>
        </header>

        <div className={`dm-grid-wrap ${editMode ? "is-editing" : ""}`}>
          <Grid
            className="dm-grid"
            layout={layout}
            cols={12}
            rowHeight={48}
            margin={[14, 14]}
            containerPadding={[0, 0]}
            isDraggable={editMode}
            isResizable={editMode}
            draggableHandle=".dm-card-handle"
            onLayoutChange={handleLayoutChange}
            compactType="vertical"
            preventCollision={false}
          >
            {layout.map((it) => {
              const isKpi = it.i.startsWith("kpi:");
              return (
                <div
                  key={it.i}
                  className={`dm-card dm-card--grid ${isKpi ? "dm-card--kpi" : ""}`}
                >
                  <div className={`dm-card-handle ${editMode ? "is-visible" : ""}`}>
                    <span className="dm-card-handle__title">{cardTitleFor(it.i, role)}</span>
                    {editMode && (
                      <button
                        type="button"
                        className="dm-card-handle__remove"
                        onClick={() => removeCard(it.i)}
                        title="Remove card"
                        aria-label="Remove card"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <CardContent id={it.i} role={role} />
                </div>
              );
            })}
          </Grid>
        </div>
      </main>

      {/* Add-card drawer */}
      {drawerOpen && (
        <>
          <div className="dm-drawer__backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="dm-drawer">
            <header className="dm-drawer__head">
              <h3 className="dm-drawer__title">Card library</h3>
              <button
                type="button"
                className="dm-drawer__close"
                onClick={() => setDrawerOpen(false)}
              >×</button>
            </header>
            {available.length === 0 ? (
              <div className="dm-drawer__empty">All available cards are on your dashboard.</div>
            ) : (
              <ul className="dm-drawer__list">
                {(["KPI", "Chart", "List", "Board"] as const).map((cat) => {
                  const inCat = available.filter((c) => c.category === cat);
                  if (inCat.length === 0) return null;
                  return (
                    <li key={cat}>
                      <div className="dm-drawer__cat">{cat}</div>
                      <ul className="dm-drawer__sublist">
                        {inCat.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="dm-drawer__item"
                              onClick={() => addCard(c)}
                            >
                              <span className="dm-drawer__item-title">{c.title}</span>
                              <span className="dm-drawer__item-meta">
                                {c.default.w}×{c.default.h}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
