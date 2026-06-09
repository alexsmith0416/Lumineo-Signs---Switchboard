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

/* ---------- Icon set (20px stroke, currentColor) — DESIGN.md §7 ---------- */
type IconName =
  | "dash" | "sched" | "inbox" | "cal"
  | "ps" | "ws" | "sb" | "tp" | "es" | "sh"
  | "set" | "help" | "moon" | "sun" | "pencil";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const p: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };
  switch (name) {
    case "dash": // 2×2 grid
      return (
        <svg {...p}>
          <rect x="3.5"  y="3.5"  width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5"  width="7" height="7" rx="1.5" />
          <rect x="3.5"  y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "sched": // checklist
      return (
        <svg {...p}>
          <path d="M7 6h12" /><path d="M7 12h12" /><path d="M7 18h12" />
          <path d="M3 5.5l1.2 1.2L6 4.6" />
          <path d="M3 11.5l1.2 1.2L6 10.6" />
          <path d="M3 17.5l1.2 1.2L6 16.6" />
        </svg>
      );
    case "inbox": // envelope
      return (
        <svg {...p}>
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
          <path d="M3.5 7l8 5.8a1 1 0 0 0 1.2 0L20.5 7" />
        </svg>
      );
    case "cal":
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17" />
          <path d="M8 3v4" /><path d="M16 3v4" />
        </svg>
      );
    case "ps": // bar chart
      return (
        <svg {...p}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-8" />
          <path d="M22 20H2" />
        </svg>
      );
    case "ws": // weekly calendar w/ dots
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17" />
          <circle cx="8" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="16" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sb": // pencil + ruler
      return (
        <svg {...p}>
          <path d="M14.4 4.6l5 5L9.2 19.8l-5.4 1.2 1.2-5.4Z" />
          <path d="M12.6 6.4l5 5" />
        </svg>
      );
    case "tp": // clock w/ camera lens
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "es": // calculator
      return (
        <svg {...p}>
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <rect x="7.5" y="5.5" width="9" height="3.5" rx="0.8" />
          <circle cx="9"  cy="13" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="13" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="9"  cy="17" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "sh": // dollar in circle
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M14.5 9.2c-.6-.7-1.6-1.1-2.6-1.1-1.7 0-2.7.9-2.7 2 0 2.6 5.6 1.6 5.6 4.2 0 1.2-1.1 2.1-2.9 2.1-1.2 0-2.4-.4-3.1-1.2" />
          <path d="M12 6v12" />
        </svg>
      );
    case "set": // gear
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 14.5a1.5 1.5 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4V20a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1A2 2 0 1 1 4.7 16.2l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9H3.5a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1A2 2 0 1 1 7.5 4.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4V3.5a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9Z" />
        </svg>
      );
    case "help":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.1 1-1.1 1.7v.5" />
          <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      );
    case "moon":
      return (
        <svg {...p}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" />
          <path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" />
          <path d="M2 12h2" /><path d="M20 12h2" />
          <path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...p}>
          <path d="M14.4 4.6l5 5L9.2 19.8l-5.4 1.2 1.2-5.4Z" />
          <path d="M12.6 6.4l5 5" />
        </svg>
      );
  }
}

const SIDEBAR_MAIN: { key: IconName; label: string; active?: boolean; badge?: number }[] = [
  { key: "dash",  label: "Dashboard", active: true },
  { key: "sched", label: "My Schedule" },
  { key: "inbox", label: "Inbox", badge: 4 },
  { key: "cal",   label: "Calendar" },
];
const SIDEBAR_APPS: { key: IconName; label: string; badge?: number }[] = [
  { key: "ps", label: "Project Scheduler", badge: 17 },
  { key: "ws", label: "Weekly Scheduler",  badge: 23 },
  { key: "sb", label: "Sign Builder Pro" },
  { key: "tp", label: "Time & Photo" },
  { key: "es", label: "Estimating",         badge: 6 },
  { key: "sh", label: "Sales Hub",          badge: 11 },
];
const SIDEBAR_OTHER: { key: IconName; label: string }[] = [
  { key: "set",  label: "Settings" },
  { key: "help", label: "Help" },
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
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
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
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
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
              <span className="dm-sidebar__icon">
                <Icon name={theme === "light" ? "moon" : "sun"} />
              </span>
              <span className="dm-sidebar__label">{theme === "light" ? "Dark" : "Light"}</span>
            </button>
          </li>
          {SIDEBAR_OTHER.map((it) => (
            <li key={it.key}>
              <button className="dm-sidebar__item">
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
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
                className="dm-edit-btn dm-edit-btn--icon"
                onClick={() => setEditMode(true)}
              >
                <Icon name="pencil" size={14} />
                <span>Edit dashboard</span>
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
