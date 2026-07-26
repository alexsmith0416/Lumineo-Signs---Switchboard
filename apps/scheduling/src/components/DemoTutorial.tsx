/**
 * Interactive demo tutorial — a "video-game style" guided tour.
 *
 * Two phases driven by the demo store:
 *  - "welcome": a card offering a focused Scheduling tour, a Full tour, or Skip.
 *  - "running": coach-marks that spotlight a real button/element, explain it, and
 *    advance with Back / Next / Skip. Each step can first navigate to the screen
 *    it lives on (via onNavigate).
 *
 * Targets are matched by CSS selector (mostly `data-tour="…"` attributes added
 * to the sidebar, Add-Job button, toolbar, and job cards).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDemoStore, type TutorialTrack } from "../store/demo-store";

interface TourStep {
  /** Navigate to this app view before showing the step. */
  view?: string;
  /** CSS selector to spotlight. Omit for a centered, no-target card. */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

const SCHEDULING_STEPS: TourStep[] = [
  {
    view: "production",
    title: "Welcome to your sandbox 👋",
    body: "This is a full, private copy of the scheduler loaded with test jobs. Nothing you do here is saved — so go ahead and try anything. Let's schedule some work.",
    placement: "center",
  },
  {
    view: "production",
    target: '[data-tour="nav-production"]',
    title: "Switch boards here",
    body: "The sidebar switches between the Production, Installation and Shipping calendars. You're on Production now.",
    placement: "right",
  },
  {
    view: "production",
    target: '[data-tour="add-job"]',
    title: "Add a job",
    body: "Click + Add Job to search Business Central jobs and drop one onto a person's day. You can also add PTO, group cards, and more.",
    placement: "bottom",
  },
  {
    view: "production",
    target: ".gantt-card",
    title: "Every card is a job",
    body: "Drag a card to another day or another person to reschedule it. When it would push other work, a preview shows exactly what moves.",
    placement: "bottom",
  },
  {
    view: "production",
    target: ".gantt-card",
    title: "Resize to set the length",
    body: "Drag a card's right edge to make it span more (or fewer) days. Drag the left edge to change its start day. It stays exactly where you put it.",
    placement: "bottom",
  },
  {
    view: "production",
    target: ".gantt-card",
    title: "Reorder to set priority",
    body: "When a person has more than one job on the same day, drag a card up or down to set the order they work them — top = first.",
    placement: "bottom",
  },
  {
    view: "production",
    target: '[data-tour="calendar-nav"]',
    title: "Move between weeks",
    body: "Step forward and back a week here, or use Go to… to jump to any date. The demo has about four weeks of work to explore.",
    placement: "bottom",
  },
  {
    view: "production",
    title: "That's the core of it! 🎉",
    body: "You know how to add, move, resize and prioritize jobs. Explore freely — remember, nothing here is saved. Leave the demo anytime from the banner at the top.",
    placement: "center",
  },
];

const FULL_STEPS: TourStep[] = [
  ...SCHEDULING_STEPS.slice(0, 7),
  {
    view: "installation",
    target: '[data-tour="nav-installation"]',
    title: "Installation & Service",
    body: "The Installation board schedules field crews by region (WK / NEK) and location, with crew, truck and dollar details on each card.",
    placement: "right",
  },
  {
    view: "shipping",
    target: '[data-tour="nav-shipping"]',
    title: "Shipping loads",
    body: "The Shipping board plans truck loads out to each city. Add loads per day and group the items going on each truck.",
    placement: "right",
  },
  {
    view: "monthly",
    target: '[data-tour="nav-monthly"]',
    title: "Monthly Gameplanning",
    body: "Roll up the month and use the auto-fill to plan installs toward a goal — a big-picture view above the week-by-week boards.",
    placement: "right",
  },
  {
    view: "scenario",
    target: '[data-tour="nav-scenario"]',
    title: "Scenario Sandbox",
    body: "Try what-if changes in an isolated copy without touching the live board — perfect for testing a plan before committing.",
    placement: "right",
  },
  {
    view: "settings",
    target: '[data-tour="nav-settings"]',
    title: "Settings",
    body: "Toggle auto-cascade, the current-time line, presentation mode, and more. Your preferences are remembered per device.",
    placement: "right",
  },
  {
    view: "production",
    title: "You've seen it all 🎉",
    body: "That's the full app. Explore as long as you like — nothing here is saved. Leave the demo anytime from the banner at the top.",
    placement: "center",
  },
];

const TRACKS: Record<TutorialTrack, TourStep[]> = {
  scheduling: SCHEDULING_STEPS,
  full: FULL_STEPS,
};

const POP_W = 340;
const POP_H = 210;

function computePop(
  rect: DOMRect | null,
  placement: TourStep["placement"],
): { top: number; left: number } {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || placement === "center") {
    return { top: vh / 2 - POP_H / 2, left: vw / 2 - POP_W / 2 };
  }
  let top = 0;
  let left = 0;
  switch (placement ?? "bottom") {
    case "top":
      top = rect.top - gap - POP_H;
      left = rect.left + rect.width / 2 - POP_W / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - POP_H / 2;
      left = rect.left - gap - POP_W;
      break;
    case "right":
      top = rect.top + rect.height / 2 - POP_H / 2;
      left = rect.right + gap;
      break;
    case "bottom":
    default:
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - POP_W / 2;
      break;
  }
  left = Math.max(12, Math.min(left, vw - POP_W - 12));
  top = Math.max(12, Math.min(top, vh - POP_H - 12));
  return { top, left };
}

interface Props {
  /** Switch the app to a given view (so a step can point at that screen). */
  onNavigate: (view: string) => void;
}

export default function DemoTutorial({ onNavigate }: Props) {
  const phase = useDemoStore((s) => s.tutorialPhase);
  const track = useDemoStore((s) => s.track);
  const stepIndex = useDemoStore((s) => s.stepIndex);
  const startTrack = useDemoStore((s) => s.startTrack);
  const nextStep = useDemoStore((s) => s.nextStep);
  const prevStep = useDemoStore((s) => s.prevStep);
  const endTutorial = useDemoStore((s) => s.endTutorial);

  const steps = track ? TRACKS[track] : [];
  const step = phase === "running" ? steps[stepIndex] : undefined;

  const [rect, setRect] = useState<DOMRect | null>(null);

  // Navigate to the step's screen first (idempotent).
  useEffect(() => {
    if (step?.view) onNavigate(step.view);
  }, [step, onNavigate]);

  // Find + measure the target, retrying across a few frames while the screen
  // renders. Re-measure on scroll/resize so the spotlight tracks the element.
  useEffect(() => {
    if (!step || !step.target) {
      setRect(null);
      return;
    }
    const sel = step.target;
    let raf = 0;
    let tries = 0;
    const find = () => document.querySelector(sel) as HTMLElement | null;
    const measure = () => {
      const el = find();
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 40) {
        raf = requestAnimationFrame(measure);
      } else {
        setRect(null);
      }
    };
    raf = requestAnimationFrame(measure);
    const track2 = () => {
      const el = find();
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", track2);
    window.addEventListener("scroll", track2, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", track2);
      window.removeEventListener("scroll", track2, true);
    };
  }, [step, stepIndex]);

  if (phase === null) return null;

  // ---- Welcome card ----
  if (phase === "welcome") {
    return createPortal(
      <div className="tour-scrim tour-scrim--center">
        <div className="tour-welcome" role="dialog" aria-modal="true">
          <div className="tour-welcome__eyebrow">Interactive Demo</div>
          <h2 className="tour-welcome__title">Want a quick guided tour?</h2>
          <p className="tour-welcome__sub">
            You're in a safe sandbox — a private copy of the scheduler loaded with test
            jobs. Nothing you do here is saved, so feel free to try anything.
          </p>
          <div className="tour-welcome__choices">
            <button type="button" className="tour-choice" onClick={() => startTrack("scheduling")}>
              <span className="tour-choice__title">Scheduling tour</span>
              <span className="tour-choice__meta">~2 min · adding &amp; organizing jobs</span>
            </button>
            <button type="button" className="tour-choice" onClick={() => startTrack("full")}>
              <span className="tour-choice__title">Full tour</span>
              <span className="tour-choice__meta">every screen &amp; feature</span>
            </button>
          </div>
          <button type="button" className="tour-welcome__skip" onClick={endTutorial}>
            Skip — just let me explore
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // ---- Coach-mark ----
  if (!step) return null;
  const total = steps.length;
  const isLast = stepIndex >= total - 1;
  const hasSpot = !!step.target && !!rect && step.placement !== "center";
  const pop = computePop(hasSpot ? rect : null, step.placement);

  return createPortal(
    <>
      {hasSpot && rect ? (
        <div
          className="tour-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : (
        <div className="tour-scrim" />
      )}
      <div className="tour-pop" style={{ top: pop.top, left: pop.left, width: POP_W }} role="dialog">
        <div className="tour-pop__step">
          Step {stepIndex + 1} of {total}
        </div>
        <h3 className="tour-pop__title">{step.title}</h3>
        <p className="tour-pop__body">{step.body}</p>
        <div className="tour-pop__nav">
          <button type="button" className="tour-pop__skip" onClick={endTutorial}>
            Skip tour
          </button>
          <div className="tour-pop__btns">
            {stepIndex > 0 && (
              <button type="button" className="tour-btn tour-btn--ghost" onClick={prevStep}>
                Back
              </button>
            )}
            <button
              type="button"
              className="tour-btn tour-btn--primary"
              onClick={() => (isLast ? endTutorial() : nextStep())}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
