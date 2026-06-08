import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Role } from "../types";
import {
  DonutBody,
  KanbanBody,
  KpiCardBody,
  TargetsBody,
  getKpiList,
} from "../dashboard/cards";
import { usersByRole } from "../data/mockData";
import DashboardMobile from "./DashboardMobile";

const Grid = WidthProvider(GridLayout);

interface Props {
  role: Role;
  onBack?: () => void;
}

type Theme = "light" | "dark";

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

/* ---------- Card catalog ---------- */

type CardId =
  | `kpi:${string}`
  | "donut"
  | "targets"
  | "kanban";

interface CardDef {
  id: CardId;
  title: string;
  category: "KPI" | "Chart" | "List" | "Board";
  default: { w: number; h: number };
  min: { w: number; h: number };
}

function buildCatalog(_role: Role): CardDef[] {
  // KPIs live in the fixed horizontal strip at the top — only larger
  // cards are arrangeable inside the customizable grid.
  return [
    { id: "donut",   title: "Production Department Workloads", category: "Chart", default: { w: 6, h: 6 }, min: { w: 4, h: 4 } },
    { id: "targets", title: "Upcoming Target Dates",            category: "List",  default: { w: 6, h: 6 }, min: { w: 4, h: 4 } },
    { id: "kanban",  title: "Production Board (Kanban)",        category: "Board", default: { w: 12, h: 8 }, min: { w: 6, h: 6 } },
  ];
}

/* ---------- Layout persistence ---------- */

type Item = { i: string; x: number; y: number; w: number; h: number; minW: number; minH: number };

function defaultLayout(_role: Role): Item[] {
  return [
    { i: "donut",   x: 0, y: 0, w: 6,  h: 6, minW: 4, minH: 4 },
    { i: "targets", x: 6, y: 0, w: 6,  h: 6, minW: 4, minH: 4 },
    { i: "kanban",  x: 0, y: 6, w: 12, h: 8, minW: 6, minH: 6 },
  ];
}

const LS_KEY = (role: Role) => `dm-layout-v2-${role}`;

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

function CardContent({ id }: { id: string }) {
  if (id === "donut")   return <DonutBody />;
  if (id === "targets") return <TargetsBody />;
  if (id === "kanban")  return <KanbanBody />;
  return null;
}

function cardTitleFor(id: string): string {
  if (id === "donut")   return "Production Department Workloads";
  if (id === "targets") return "Upcoming Target Dates";
  if (id === "kanban")  return "Production Board";
  return id;
}

/* ---------- Horizontal-scrolling KPI strip ---------- */

function KpiStrip({ role }: { role: Role }) {
  const kpis = getKpiList(role);
  const trackRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="dm-kpi-strip" aria-label="KPIs">
      <div className="dm-kpi-strip__track" ref={trackRef}>
        {kpis.map((k) => (
          <article key={k.key} className="dm-kpi-strip__card dm-kpi">
            <KpiCardBody k={k} />
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Main component ---------- */

/** Hand off to the dedicated mobile layout below 820px. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < 820,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return mobile;
}

export default function DashboardCustomizable({ role, onBack }: Props) {
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<Theme>("light");
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layout, setLayout] = useState<Item[]>(() => loadLayout(role));
  const user = usersByRole[role];
  const catalog = useMemo(() => buildCatalog(role), [role]);

  if (isMobile) {
    return (
      <DashboardMobile
        role={role}
        theme={theme}
        onChangeTheme={setTheme}
        onBack={onBack}
      />
    );
  }

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
          <li>
            <button
              type="button"
              className="dm-sidebar__item dm-sidebar__theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              <span className="dm-sidebar__icon">{theme === "light" ? "🌙" : "☀️"}</span>
              <span className="dm-sidebar__label">{theme === "light" ? "Dark" : "Light"}</span>
            </button>
          </li>
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
            {onBack && (
              <button type="button" className="dm-back" onClick={onBack}>← Splash</button>
            )}
            <div className="dm-user">
              <div className="dm-user__avatar">{user.initials}</div>
              <div>
                <div className="dm-user__name">{user.name}</div>
                <div className="dm-user__role">{role}</div>
              </div>
            </div>
          </div>
        </header>

        <KpiStrip role={role} />

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
                    <span className="dm-card-handle__title">{cardTitleFor(it.i)}</span>
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
                  <CardContent id={it.i} />
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
