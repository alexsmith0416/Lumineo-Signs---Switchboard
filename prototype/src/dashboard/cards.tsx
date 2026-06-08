import { useEffect, useRef, useState } from "react";
import type { Role } from "../types";
import { kpisByRole, safetyMetric } from "../data/mockData";

/* ============ Shared dashboard data ============ */

/** Source: Built To Shine newsletter, week of June 8, 2026. */
export const DEPT_WORKLOAD = [
  { name: "Vinyl Cut / Apply", count: 19, pct: 28.4, delta: -17, color: "green" },
  { name: "Assembly",          count: 15, pct: 22.4, delta:  -1, color: "red" },
  { name: "Paint",             count: 11, pct: 16.4, delta:  +6, color: "blue" },
  { name: "Routing",           count: 10, pct: 14.9, delta:  +3, color: "amber" },
  { name: "Vinyl Install",     count:  5, pct:  7.5, delta:  +1, color: "pink" },
  { name: "Metal Fab",         count:  4, pct:  6.0, delta:  -4, color: "navy" },
  { name: "Material Cut",      count:  3, pct:  4.5, delta:  -1, color: "violet" },
] as const;
export const TOTAL_PROJECTS = DEPT_WORKLOAD.reduce((s, d) => s + d.count, 0);

/** Upcoming Target Dates — three tabs from the newsletter. */
export interface TargetRow {
  id: string;
  dateLabel: string;
  daysUntil: number;
  jobNumber: string;
  customer: string;
  scope: string;
  status: "On track" | "At risk" | "Behind";
}

export const TARGETS_WK: TargetRow[] = [
  { id: "wk-1", dateLabel: "Mon Jun 8",  daysUntil: 0, jobNumber: "J37422", customer: "State Farm",          scope: "Bringing in (1) monument sign for refurb",  status: "On track" },
  { id: "wk-2", dateLabel: "Tue Jun 9",  daysUntil: 1, jobNumber: "J37094", customer: "Intellicents",        scope: "Interior window vinyl graphics",            status: "On track" },
  { id: "wk-3", dateLabel: "Tue Jun 9",  daysUntil: 1, jobNumber: "J36732", customer: "CHCT Kansas",         scope: "Door & window vinyl graphics",              status: "At risk"  },
  { id: "wk-4", dateLabel: "Wed Jun 10", daysUntil: 2, jobNumber: "J37290", customer: "Fine Arts Dentistry", scope: "Bringing in (1) monument sign for refurb",  status: "On track" },
  { id: "wk-5", dateLabel: "Wed Jun 10", daysUntil: 2, jobNumber: "J37648", customer: "Disability Supports", scope: "Door vinyl graphics",                       status: "On track" },
  { id: "wk-6", dateLabel: "Sat Jun 13", daysUntil: 5, jobNumber: "J35522", customer: "Gallagher",           scope: "(2) Routed push-thru tenant panels",        status: "On track" },
  { id: "wk-7", dateLabel: "Mon Jun 15", daysUntil: 7, jobNumber: "J36515", customer: "Children's Mercy",    scope: "(2) N/I monument signs",                    status: "On track" },
  { id: "wk-8", dateLabel: "Mon Jun 15", daysUntil: 7, jobNumber: "J36516", customer: "Children's Mercy",    scope: "(1) N/I monument sign",                     status: "On track" },
  { id: "wk-9", dateLabel: "Fri Jun 19", daysUntil: 11,jobNumber: "J33999", customer: "Disability Supports", scope: "Bringing in (1) monument sign for refurb",  status: "On track" },
  { id: "wk-10",dateLabel: "Fri Jun 19", daysUntil: 11,jobNumber: "J34000", customer: "Disability Supports", scope: "Bringing in (1) monument sign for refurb",  status: "On track" },
];

export const TARGETS_NEK: TargetRow[] = [
  { id: "nek-1",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J34368", customer: "Walnut Reserve",   scope: "Wood covered monument sign w/ channel letters", status: "On track" },
  { id: "nek-2",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J33316", customer: "Greenbush",         scope: "Painted PVC & aluminum panel",                  status: "On track" },
  { id: "nek-3",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J34690", customer: "Greenbush",         scope: "Painted PVC & aluminum panels w/ backed Sintra",status: "On track" },
  { id: "nek-4",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J34689", customer: "Greenbush",         scope: "Painted PVC & aluminum panel",                  status: "On track" },
  { id: "nek-5",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J34926", customer: "Greenbush",         scope: "(1) Pan sign w/ FCOs",                          status: "On track" },
  { id: "nek-6",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J36121", customer: "Greenbush",         scope: "Monument sign w/ FCOs",                         status: "On track" },
  { id: "nek-7",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J34687", customer: "Greenbush",         scope: "(2) Pan signs w/ vinyl artwork",                status: "At risk"  },
  { id: "nek-8",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J36878", customer: "Leroy CTC",         scope: "(1) Pan sign w/ FCOs",                          status: "On track" },
  { id: "nek-9",  dateLabel: "Wed Jun 17", daysUntil: 9, jobNumber: "J37420", customer: "811 Garage",        scope: "(1) Routed & backed I/I wall sign cabinet",     status: "On track" },
];

export const TARGETS_SHIPPING: TargetRow[] = [
  { id: "sh-1", dateLabel: "ASAP",       daysUntil: 0, jobNumber: "J29155", customer: "Morton Building",        scope: "(1) Pole sign cabinet & (1) door vinyl graphic", status: "Behind"  },
  { id: "sh-2", dateLabel: "CO · TBD",   daysUntil: 0, jobNumber: "J35260", customer: "Meritrust Credit Union", scope: "(1) Monument sign — Colorado shipment",          status: "At risk" },
  { id: "sh-3", dateLabel: "CO · TBD",   daysUntil: 0, jobNumber: "J37535", customer: "Schramm Feedlot",         scope: "(2) Large ACM sign faces — Colorado shipment",   status: "At risk" },
];

/* ============ KPI view model with chart hints ============ */

export type ChartHint = "gauge" | "sparkline" | "bars" | "progress" | "none";

export type KpiVm = {
  key: string;
  label: string;
  value: number;
  valueFormat: "currency" | "int" | "hours" | "percent" | "text";
  textValue?: string;
  goal?: string;
  goalNum?: number;       // numeric goal used by gauge / progress
  delta?: number;
  deltaDirection?: "up" | "down" | "flat";
  deltaIsGood?: boolean;
  sparkline?: number[];
  chart?: ChartHint;
};

const CHART_BY_KEY: Record<string, { hint: ChartHint; goalNum?: number }> = {
  safety:                 { hint: "gauge",    goalNum: 365 },
  gm_pct_april:           { hint: "bars" },
  gm_pct_ytd:             { hint: "sparkline" },
  dip_avg_days:           { hint: "sparkline" },
  value_open_jobs:        { hint: "sparkline" },
  rev_completions_april:  { hint: "bars" },
  rev_completions_ytd:    { hint: "progress", goalNum: 4400 },
  new_orders_april:       { hint: "bars" },
  new_orders_ytd:         { hint: "progress", goalNum: 4315 },
  emp_sat_score:          { hint: "gauge",    goalNum: 5 },
};

export function getKpiList(role: Role): KpiVm[] {
  const safety: KpiVm = {
    key: "safety",
    label: "Days Since Lost Time",
    value: safetyMetric.currentStreakDays,
    valueFormat: "int",
    goal: "> 365 days",
    sparkline: [331, 359, 390, 78],
    ...CHART_BY_KEY.safety,
    chart: CHART_BY_KEY.safety.hint,
  };
  return [
    safety,
    ...kpisByRole[role].map((k) => {
      const meta = CHART_BY_KEY[k.key] ?? { hint: "sparkline" as ChartHint };
      return { ...k, chart: meta.hint, goalNum: meta.goalNum } as KpiVm;
    }),
  ];
}

export function formatValue(value: number, fmt: string, textValue?: string): string {
  if (fmt === "text") return textValue ?? "—";
  if (fmt === "currency") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (fmt === "percent") return value + "%";
  if (fmt === "hours") return value.toLocaleString() + "h";
  return value.toLocaleString();
}

/* ============ Mini-chart components ============ */

function Sparkline({ data, color = "var(--dm-navy)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  // viewBox uses normalized units; container CSS controls actual pixel size.
  const W = 100, H = 100, P = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (W - P * 2) / Math.max(data.length - 1, 1);
  const pts = data
    .map((v, i) => {
      const x = P + i * stepX;
      const y = P + (1 - (v - min) / range) * (H - P * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = data[data.length - 1];
  const lastX = P + (data.length - 1) * stepX;
  const lastY = P + (1 - (last - min) / range) * (H - P * 2);
  // Area fill underneath line for visual richness
  const areaPts = `${pts} ${(P + (data.length - 1) * stepX).toFixed(1)},${H - P} ${P},${H - P}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="dm-mini-chart"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
    >
      <polygon points={areaPts} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MiniBars({ data, color = "var(--dm-navy)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const W = 100, H = 100, gap = 4;
  const max = Math.max(...data) || 1;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="dm-mini-chart"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
    >
      {data.map((v, i) => {
        const h = (v / max) * (H - 4);
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.4}
            fill={i === data.length - 1 ? color : "var(--dm-border)"}
          />
        );
      })}
    </svg>
  );
}

function ProgressBar({ pct, color = "var(--dm-navy)" }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(pct, 130));
  return (
    <div className="dm-mini-progress" title={`${pct.toFixed(0)}%`}>
      <div className="dm-mini-progress__track">
        <div
          className="dm-mini-progress__fill"
          style={{ width: `${Math.min(clamped, 100)}%`, background: color }}
        />
        {clamped > 100 && (
          <div
            className="dm-mini-progress__over"
            style={{ width: `${clamped - 100}%` }}
          />
        )}
      </div>
      <span className="dm-mini-progress__lbl">{Math.round(pct)}%</span>
    </div>
  );
}

function Gauge({ value, max, color = "var(--dm-navy)" }: { value: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(value / max, 1));
  const W = 100, H = 56, r = 40, cx = W / 2, cy = H - 4;
  const start = Math.PI; // 180°
  const end = start + pct * Math.PI;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const bgEnd = start + Math.PI;
  const bgX2 = cx + r * Math.cos(bgEnd);
  const bgY2 = cy + r * Math.sin(bgEnd);
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="dm-mini-chart dm-mini-chart--gauge"
      preserveAspectRatio="xMidYMax meet"
      width="100%"
      height="100%"
    >
      <path d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 1 1 ${bgX2.toFixed(1)} ${bgY2.toFixed(1)}`} fill="none" stroke="var(--dm-border-soft)" strokeWidth="7" strokeLinecap="round" />
      <path d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function chartColorFor(k: KpiVm): string {
  if (k.deltaDirection === "flat") return "var(--dm-text-dim)";
  if (k.deltaIsGood === true) return "var(--dm-green)";
  if (k.deltaIsGood === false) return "var(--dm-red)";
  return "var(--dm-navy)";
}

export function KpiMiniChart({ k }: { k: KpiVm }) {
  const color = chartColorFor(k);
  const data = k.sparkline ?? [];
  switch (k.chart) {
    case "gauge": {
      const max = k.goalNum ?? k.value * 1.2;
      return <Gauge value={k.value} max={max} color={color} />;
    }
    case "bars":
      return <MiniBars data={data} color={color} />;
    case "sparkline":
      return <Sparkline data={data} color={color} />;
    case "progress": {
      // value and goalNum are in same scale (e.g., $ in thousands for currency)
      const v = k.valueFormat === "currency" ? k.value / 1000 : k.value;
      const g = k.goalNum ?? 100;
      return <ProgressBar pct={(v / g) * 100} color={color} />;
    }
    default:
      return data.length ? <Sparkline data={data} color={color} /> : null;
  }
}

/* ============ Reusable card body renderers ============ */

export function KpiCardBody({ k }: { k: KpiVm }) {
  const showDelta = !!k.deltaDirection && k.valueFormat !== "text" && k.delta != null;
  const arrow =
    k.deltaDirection === "up" ? "▲" : k.deltaDirection === "down" ? "▼" : "▬";
  const cls =
    k.deltaDirection === "flat" ? "is-flat" : k.deltaIsGood ? "is-good" : "is-bad";
  const hasChart = k.chart !== "none" && k.valueFormat !== "text";
  return (
    <div className="dm-kpi-body">
      <div className="dm-kpi__topline">
        <div className="dm-kpi__label">{k.label}</div>
        {showDelta && (
          <span className={`dm-kpi__delta ${cls}`}>
            {arrow} {k.delta}{k.valueFormat === "percent" ? "pp" : "%"}
          </span>
        )}
      </div>
      <div className={`dm-kpi__value ${k.valueFormat === "text" ? "is-text" : ""}`}>
        {formatValue(k.value, k.valueFormat, k.textValue)}
      </div>
      {hasChart && (
        <div className="dm-kpi__chart" data-chart={k.chart}>
          <KpiMiniChart k={k} />
        </div>
      )}
      <div className="dm-kpi__foot">
        {k.goal && <span className="dm-kpi__goal">Goal {k.goal}</span>}
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
          {DEPT_WORKLOAD.map((d) => {
            const deltaCls = d.delta > 0 ? "is-up" : d.delta < 0 ? "is-down" : "is-flat";
            const deltaTxt = d.delta > 0 ? `+${d.delta}` : `${d.delta}`;
            return (
              <li key={d.name} className="dm-donut__row">
                <span className="dm-donut__swatch" style={{ background: `var(--dm-swatch-${d.color})` }} />
                <span className="dm-donut__name">{d.name}</span>
                <span className="dm-donut__qty">
                  {d.count} <span className="dm-donut__qtysep">·</span> {d.pct}%
                </span>
                <span className={`dm-donut__delta ${deltaCls}`}>{deltaTxt}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ============ Upcoming Target Dates — WK / NEK / Shipping tabs ============ */

type TargetsTab = "WK" | "NEK" | "Shipping";

const TAB_DATA: Record<TargetsTab, { rows: TargetRow[]; label: string; sub: string }> = {
  WK:       { rows: TARGETS_WK,       label: "WK",       sub: "Wichita install dates" },
  NEK:      { rows: TARGETS_NEK,      label: "NEK",      sub: "Northeast Kansas — 6/17 shipment" },
  Shipping: { rows: TARGETS_SHIPPING, label: "Shipping", sub: "ASAP & out-of-state" },
};

export function TargetsBody({
  showTabs = true,
  limit,
}: { showTabs?: boolean; limit?: number } = {}) {
  const [tab, setTab] = useState<TargetsTab>("WK");
  const cfg = TAB_DATA[tab];
  const rows = typeof limit === "number" ? cfg.rows.slice(0, limit) : cfg.rows;
  const tone = (s: TargetRow["status"]) =>
    s === "On track" ? "green" : s === "At risk" ? "amber" : "red";

  return (
    <div className="dm-card-body">
      {showTabs && (
        <div className="dm-pill-toggle dm-pill-toggle--inline">
          {(Object.keys(TAB_DATA) as TargetsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`dm-pill-toggle__btn ${tab === t ? "is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_DATA[t].label}
              <span className="dm-pill-toggle__count">{TAB_DATA[t].rows.length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="dm-targets__caption">{cfg.sub}</div>
      <ul className="dm-targets__list">
        {rows.map((t) => (
          <li key={t.id} className="dm-targets__row">
            <div className="dm-targets__when">
              <div className="dm-targets__date">{t.dateLabel}</div>
              {t.daysUntil > 0 && (
                <div className="dm-targets__until">{t.daysUntil} d</div>
              )}
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

/* ============ Drag-and-drop Kanban (test card + add buttons) ============ */

export type KanbanColumnId = "To Do" | "In Progress" | "Review" | "Completed";
export type KanbanPriority = "High" | "Medium" | "Low";

export interface KanbanCard {
  id: string;
  jobName: string;
  description: string;
  dueDate: string;
  importance: KanbanPriority;
  column: KanbanColumnId;
}

const COLS: { id: KanbanColumnId; tone: string }[] = [
  { id: "To Do",       tone: "navy"  },
  { id: "In Progress", tone: "blue"  },
  { id: "Review",      tone: "amber" },
  { id: "Completed",   tone: "green" },
];

const SEED_CARDS: KanbanCard[] = [
  {
    id: "card-test-1",
    jobName: "Test Job",
    description: "Sample card — drag me between columns to try it out.",
    dueDate: "Fri Jun 12",
    importance: "Medium",
    column: "To Do",
  },
];

function priorityTone(p: KanbanPriority): string {
  return p === "High" ? "red" : p === "Medium" ? "amber" : "navy";
}

export function KanbanBody() {
  const storageKey = useRef("dm-kanban-v1");
  const [cards, setCards] = useState<KanbanCard[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey.current);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as KanbanCard[];
      }
    } catch {/* ignore */}
    return SEED_CARDS;
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey.current, JSON.stringify(cards)); } catch {/* ignore */}
  }, [cards]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draftCol, setDraftCol] = useState<KanbanColumnId | null>(null);
  const [draft, setDraft] = useState<Omit<KanbanCard, "id" | "column">>({
    jobName: "", description: "", dueDate: "", importance: "Medium",
  });

  function moveTo(cardId: string, col: KanbanColumnId) {
    setCards((cs) =>
      cs.map((c) => (c.id === cardId ? { ...c, column: col } : c)),
    );
  }

  function addCard(col: KanbanColumnId) {
    if (!draft.jobName.trim()) return;
    setCards((cs) => [
      ...cs,
      {
        id: `card-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        jobName: draft.jobName.trim(),
        description: draft.description.trim() || "—",
        dueDate: draft.dueDate.trim() || "TBD",
        importance: draft.importance,
        column: col,
      },
    ]);
    setDraft({ jobName: "", description: "", dueDate: "", importance: "Medium" });
    setDraftCol(null);
  }

  function removeCard(cardId: string) {
    setCards((cs) => cs.filter((c) => c.id !== cardId));
  }

  return (
    <div className="dm-card-body">
      <div className="dm-kanban__cols">
        {COLS.map(({ id: colId }) => {
          const colCards = cards.filter((c) => c.column === colId);
          return (
            <div
              key={colId}
              className="dm-kanban__col"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.dataTransfer.getData("text/x-kanban-id");
                if (id) moveTo(id, colId);
                setDraggingId(null);
              }}
            >
              <div className="dm-kanban__colhead">
                <span className="dm-kanban__coldot" data-col={colId} />
                <span className="dm-kanban__colname">{colId}</span>
                <span className="dm-kanban__colcount">{colCards.length}</span>
              </div>

              {colCards.map((c) => (
                <article
                  key={c.id}
                  className={`dm-kanban__task ${draggingId === c.id ? "is-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData("text/x-kanban-id", c.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(c.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <div className="dm-kanban__task-head">
                    <span className={`dm-pill dm-pill--${priorityTone(c.importance)} dm-pill--xs`}>
                      {c.importance}
                    </span>
                    <button
                      type="button"
                      className="dm-kanban__task-x"
                      onClick={(e) => { e.stopPropagation(); removeCard(c.id); }}
                      aria-label="Delete card"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                  <div className="dm-kanban__task-title">{c.jobName}</div>
                  <div className="dm-kanban__task-scope">{c.description}</div>
                  <div className="dm-kanban__task-foot">
                    <span>📅 {c.dueDate}</span>
                  </div>
                </article>
              ))}

              {/* + Add card */}
              {draftCol === colId ? (
                <div
                  className="dm-kanban__add-form"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    type="text"
                    placeholder="Job name"
                    value={draft.jobName}
                    onChange={(e) => setDraft({ ...draft, jobName: e.target.value })}
                  />
                  <textarea
                    placeholder="Description"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Due date (e.g. Fri Jun 12)"
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  />
                  <div className="dm-kanban__add-importance">
                    {(["High", "Medium", "Low"] as KanbanPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`dm-pill dm-pill--${priorityTone(p)} dm-pill--xs ${draft.importance === p ? "is-selected" : ""}`}
                        onClick={() => setDraft({ ...draft, importance: p })}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="dm-kanban__add-actions">
                    <button
                      type="button"
                      className="dm-kanban__add-cancel"
                      onClick={() => { setDraftCol(null); setDraft({ jobName: "", description: "", dueDate: "", importance: "Medium" }); }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="dm-kanban__add-save"
                      onClick={() => addCard(colId)}
                    >
                      Add card
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="dm-kanban__add-btn"
                  onClick={() => { setDraftCol(colId); }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  + Add card
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
