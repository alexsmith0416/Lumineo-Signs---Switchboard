import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Role } from "../types";
import {
  DonutBody,
  KanbanBody,
  KpiCardBody,
  TargetsBody,
  getKpiList,
} from "../dashboard/cards";
import { usersByRole } from "../data/mockData";

type Theme = "light" | "dark";
type Orientation = "portrait" | "landscape";

interface Props {
  role: Role;
  theme: Theme;
  onChangeTheme: (t: Theme) => void;
  onBack: () => void;
}

const NAV_ITEMS = [
  { key: "dash",  icon: "▦", label: "Home",     active: true },
  { key: "sched", icon: "▤", label: "Schedule", badge: undefined as number | undefined },
  { key: "inbox", icon: "✉", label: "Inbox",    badge: 4 },
  { key: "apps",  icon: "▦▦", label: "Apps" },
  { key: "more",  icon: "≡", label: "More" },
];

/* ---------- Orientation hook ---------- */
function useOrientation(): Orientation {
  const compute = (): Orientation =>
    typeof window === "undefined"
      ? "portrait"
      : window.innerWidth > window.innerHeight
        ? "landscape"
        : "portrait";
  const [o, setO] = useState<Orientation>(compute);
  useEffect(() => {
    const onChange = () => setO(compute());
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);
  return o;
}

/* ---------- Modal ---------- */
function CardModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="dm-mob-modal" role="dialog" aria-modal="true">
      <div className="dm-mob-modal__backdrop" onClick={onClose} />
      <div className="dm-mob-modal__panel">
        <header className="dm-mob-modal__head">
          <h3 className="dm-mob-modal__title">{title}</h3>
          <button
            type="button"
            className="dm-mob-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="dm-mob-modal__body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Collapsible (portrait) ---------- */
function CollapsibleCard({
  title,
  defaultOpen = false,
  onExpand,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  onExpand: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <article className={`dm-mob-card ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="dm-mob-card__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={`dm-mob-card__chevron ${open ? "is-open" : ""}`}>▸</span>
        <span className="dm-mob-card__title">{title}</span>
        <button
          type="button"
          className="dm-mob-card__expand"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          aria-label={`Open ${title} full screen`}
          title="Open full screen"
        >
          ⤢
        </button>
      </button>
      {open && <div className="dm-mob-card__body">{children}</div>}
    </article>
  );
}

/* ---------- Stacked (landscape, always open) ---------- */
function StackedCard({
  title,
  onExpand,
  children,
}: {
  title: string;
  onExpand: () => void;
  children: ReactNode;
}) {
  return (
    <article className="dm-mob-card dm-mob-card--stacked is-open">
      <div className="dm-mob-card__head dm-mob-card__head--static">
        <span className="dm-mob-card__title">{title}</span>
        <button
          type="button"
          className="dm-mob-card__expand"
          onClick={onExpand}
          aria-label={`Open ${title} full screen`}
          title="Open full screen"
        >
          ⤢
        </button>
      </div>
      <div className="dm-mob-card__body">{children}</div>
    </article>
  );
}

/* ---------- KPI horizontal scroller ---------- */
function KpiRow({
  role,
  onTap,
}: {
  role: Role;
  onTap: (id: string) => void;
}) {
  const kpis = getKpiList(role);
  return (
    <section className="dm-mob-kpis" aria-label="KPIs">
      <div className="dm-mob-kpis__track">
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            className="dm-mob-kpis__card dm-kpi"
            onClick={() => onTap(`kpi:${k.key}`)}
          >
            <KpiCardBody k={k} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Modal content dispatch ---------- */
function modalContentFor(
  id: string,
  role: Role,
): { title: string; body: ReactNode } {
  if (id.startsWith("kpi:")) {
    const k = getKpiList(role).find((x) => `kpi:${x.key}` === id);
    if (!k) return { title: "KPI", body: <div /> };
    return { title: k.label, body: <KpiCardBody k={k} /> };
  }
  if (id === "donut")
    return {
      title: "Production Department Workloads",
      body: <DonutBody />,
    };
  if (id === "targets")
    return { title: "Upcoming Target Dates", body: <TargetsBody /> };
  if (id === "kanban")
    return { title: "Production Board", body: <KanbanBody /> };
  return { title: id, body: null };
}

/* ---------- Main ---------- */
export default function DashboardMobile({
  role,
  theme,
  onChangeTheme,
  onBack,
}: Props) {
  const orientation = useOrientation();
  const user = usersByRole[role];
  const [modalId, setModalId] = useState<string | null>(null);

  const openModal = (id: string) => setModalId(id);
  const closeModal = () => setModalId(null);

  return (
    <div
      className="dm-root dm-mob-root"
      data-theme={theme}
      data-orientation={orientation}
    >
      {/* Top bar */}
      <header className="dm-mob-top">
        <div className="dm-mob-top__left">
          <button
            type="button"
            className="dm-mob-back"
            onClick={onBack}
            aria-label="Back to splash"
          >
            ←
          </button>
          <div>
            <div className="dm-mob-top__crumb">Dashboard</div>
            <div className="dm-mob-top__title">Hi {user.name.split(" ")[0]}</div>
          </div>
        </div>
        <div className="dm-mob-top__right">
          <button
            type="button"
            className="dm-theme-toggle"
            onClick={() => onChangeTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle theme"
          >
            <span className="dm-theme-toggle__icon">
              {theme === "light" ? "🌙" : "☀️"}
            </span>
          </button>
          <div className="dm-mob-avatar">{user.initials}</div>
        </div>
      </header>

      {/* Main content */}
      <main className="dm-mob-main">
        <KpiRow role={role} onTap={openModal} />

        {orientation === "portrait" ? (
          <>
            <button
              type="button"
              className="dm-mob-donut-tap"
              onClick={() => openModal("donut")}
              aria-label="Open Department Workloads full screen"
            >
              <div className="dm-mob-donut-tap__head">
                <span className="dm-mob-donut-tap__title">
                  Department Workloads
                </span>
                <span className="dm-mob-card__expand" aria-hidden="true">⤢</span>
              </div>
              <DonutBody stackLegend />
            </button>

            <CollapsibleCard
              title="Upcoming Target Dates"
              defaultOpen
              onExpand={() => openModal("targets")}
            >
              <TargetsBody />
            </CollapsibleCard>

            <CollapsibleCard
              title="Production Board"
              onExpand={() => openModal("kanban")}
            >
              <KanbanBody />
            </CollapsibleCard>
          </>
        ) : (
          <div className="dm-mob-land">
            <div className="dm-mob-land__left">
              <button
                type="button"
                className="dm-mob-donut-tap"
                onClick={() => openModal("donut")}
                aria-label="Open Department Workloads full screen"
              >
                <div className="dm-mob-donut-tap__head">
                  <span className="dm-mob-donut-tap__title">
                    Department Workloads
                  </span>
                  <span className="dm-mob-card__expand" aria-hidden="true">⤢</span>
                </div>
                <DonutBody stackLegend />
              </button>
            </div>
            <div className="dm-mob-land__right">
              <StackedCard
                title="Upcoming Target Dates"
                onExpand={() => openModal("targets")}
              >
                <TargetsBody />
              </StackedCard>
              <StackedCard
                title="Production Board"
                onExpand={() => openModal("kanban")}
              >
                <KanbanBody />
              </StackedCard>
            </div>
          </div>
        )}
      </main>

      {/* Nav — bottom in portrait, left rail in landscape */}
      <nav className="dm-mob-nav" aria-label="Primary">
        {NAV_ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`dm-mob-nav__item ${it.active ? "is-active" : ""}`}
          >
            <span className="dm-mob-nav__icon">{it.icon}</span>
            <span className="dm-mob-nav__label">{it.label}</span>
            {it.badge != null && (
              <span className="dm-mob-nav__badge">{it.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Full-screen modal */}
      {modalId && (() => {
        const { title, body } = modalContentFor(modalId, role);
        return (
          <CardModal title={title} onClose={closeModal}>
            {body}
          </CardModal>
        );
      })()}
    </div>
  );
}
