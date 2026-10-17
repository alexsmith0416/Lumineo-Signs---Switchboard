/**
 * Interactive demo tutorial — the same "video-game style" guided tour as
 * Switchboard (welcome card → coach-marks that spotlight real controls).
 *
 * Targets are `data-tour="…"` attributes (and a few class selectors). Keep this
 * in step with the app: a significant new feature gets a step in FULL_STEPS in
 * the same change (START-HERE §6 "Interactive tour").
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDemoStore, type TutorialTrack } from "../store/demo-store";

interface TourStep {
  /** Open this view before showing the step. */
  view?: string;
  /** CSS selector to spotlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
}

const BUILDER_STEPS: TourStep[] = [
  {
    view: "dashboard",
    title: "Welcome to the Sign Builder sandbox 👋",
    body: "This is a private copy with sample specs, using the real questions. Nothing you do here is saved — try anything. Let's spec a sign.",
    placement: "center",
  },
  {
    view: "dashboard",
    target: '[data-tour="new-spec"]',
    title: "Start a spec",
    body: "+ New Spec starts a spec. Specs also open straight from an opportunity or a job (Switchboard and the BC Job Card link here).",
    placement: "bottom",
  },
  {
    view: "builder",
    target: '[data-tour="spec-header"]',
    title: "The spec",
    body: "Customer, opportunity, job and project go here. The bar shows how much of the spec is filled in; open surveys show next to it.",
    placement: "bottom",
  },
  {
    view: "builder",
    target: '[data-tour="design-reference"]',
    title: "Design reference files",
    body: "Browse… opens the job's SharePoint folder — tick the art or drawing file(s) the signs are built from. Their names go into Design Reference and each one stays a link here. (It needs the Job No.)",
    placement: "bottom",
  },
  {
    view: "builder",
    target: '[data-tour="detail-toggle"]',
    title: "Opportunity or Job details",
    body: "Opportunity details asks only the core questions sales needs. Job details asks everything the shop needs before the order is released. Switch any time — answers are kept.",
    placement: "bottom",
  },
  {
    view: "builder",
    target: '[data-tour="signs"]',
    title: "Signs on the job",
    body: "Each card is one sign: its type, quantity, how complete it is and its Spec Code. + Add sign starts another — pick its category and the questions begin.",
    placement: "top",
  },
  {
    view: "builder",
    target: ".sbp-step--next",
    title: "Answer step by step",
    body: "The highlighted card is the next question. Answer it and the page scrolls to the next one; questions an answer brings up are tagged new. The first answers (like Lighted?) pick the exact sign type for you.",
    placement: "top",
  },
  {
    view: "builder",
    target: '[data-tour="live-code"]',
    title: "Live Spec Code",
    body: "The selected sign's Spec Code builds up as you answer. Signs with the same code were built the same way — find them in the Sign Library.",
    placement: "bottom",
  },
  {
    view: "builder",
    target: '[data-tour="preview-descriptions"]',
    title: "The descriptions write themselves",
    body: "Preview Descriptions shows the Production and Field Descriptions in the job-ticket format — exactly what will go into the BC job. Tick Part #s there to show the BC part number after each material.",
    placement: "bottom",
  },
  {
    view: "builder",
    title: "That's the core of it! 🎉",
    body: "Add a sign, answer its questions, preview the descriptions. Explore freely — leave the demo any time from the banner at the top.",
    placement: "center",
  },
];

const FULL_STEPS: TourStep[] = [
  ...BUILDER_STEPS.slice(0, 8),
  {
    view: "builder",
    target: '[data-tour="reference-panel"]',
    title: "Spec reference page",
    body: "The Sign Specification Reference page that matches the sign. Click it to see it full screen — zoom, print or download it, or open the SharePoint folder.",
    placement: "left",
  },
  {
    view: "projects",
    target: '[data-tour="nav-projects"]',
    title: "Projects",
    body: "Group specs that belong together — a multi-site rollout, a campus — and see their signs and units in one place.",
    placement: "right",
  },
  {
    view: "library",
    target: '[data-tour="library-filter"]',
    title: "Sign Library",
    body: "Every sign ever spec'd. Filter by Spec Code to find signs built the same way on past jobs — handy for showing a customer one we've done before.",
    placement: "bottom",
  },
  {
    view: "help",
    target: '[data-tour="nav-help"]',
    title: "Help & this tour",
    body: "The full user guide lives under Help (download it as a PDF), and you can relaunch this demo any time.",
    placement: "right",
  },
  {
    view: "dashboard",
    title: "You've seen it all! 🎉",
    body: "Remember, nothing here is saved. Exit the demo from the banner at the top when you're ready.",
    placement: "center",
  },
];

const TRACKS: Record<TutorialTrack, TourStep[]> = {
  builder: BUILDER_STEPS,
  full: FULL_STEPS,
};

const POP_W = 340;
const POP_H = 210;

function computePop(rect: DOMRect | null, placement: TourStep["placement"]): { top: number; left: number } {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || placement === "center") return { top: vh / 2 - POP_H / 2, left: vw / 2 - POP_W / 2 };
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
    default:
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - POP_W / 2;
      break;
  }
  left = Math.max(12, Math.min(left, vw - POP_W - 12));
  top = Math.max(12, Math.min(top, vh - POP_H - 12));
  return { top, left };
}

export default function DemoTutorial({ onNavigate }: { onNavigate: (view: string) => void }) {
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

  useEffect(() => {
    if (step?.view) onNavigate(step.view);
  }, [step, onNavigate]);

  useEffect(() => {
    if (!step || !step.target) {
      setRect(null);
      return;
    }
    setRect(null);
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

  if (phase === "welcome") {
    return createPortal(
      <div className="tour-scrim tour-scrim--center">
        <div className="tour-welcome" role="dialog" aria-modal="true">
          <div className="tour-welcome__eyebrow">Interactive Demo</div>
          <h2 className="tour-welcome__title">Want a quick guided tour?</h2>
          <p className="tour-welcome__sub">
            You're in a safe sandbox — a private copy of the Sign Builder with sample specs. Nothing you do here is saved, so feel free to try anything.
          </p>
          <div className="tour-welcome__choices">
            <button type="button" className="tour-choice" onClick={() => startTrack("builder")}>
              <span className="tour-choice__title">Builder tour</span>
              <span className="tour-choice__meta">~2 min · spec a sign</span>
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

  if (!step) return null;
  const total = steps.length;
  const isLast = stepIndex >= total - 1;
  const hasSpot = !!step.target && !!rect && step.placement !== "center";
  const pop = computePop(hasSpot ? rect : null, step.placement);

  return createPortal(
    <>
      {hasSpot && rect ? (
        <div className="tour-spotlight" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />
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
            <button type="button" className="tour-btn tour-btn--primary" onClick={() => (isLast ? endTutorial() : nextStep())}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
