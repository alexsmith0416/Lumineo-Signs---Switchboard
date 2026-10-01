import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProductionStepperSection from "../ProductionStepperSection";

const WIDTH = 480;
const GAP = 4;

/**
 * The job's production stepper, editable, in a pop-up under its Jobs grid cell
 * — the same section as the job panel (complete / reopen / set active / Edit to
 * add or remove departments; every change reaches BC), without opening the job.
 * Closes on Esc, a click outside, or scrolling the list.
 */
export default function StepperPopover({
  jobNo,
  title,
  anchor,
  scrollEl,
  onClose,
}: {
  jobNo: string;
  title: string;
  /** The stepper cell's screen rectangle. */
  anchor: DOMRect;
  /** The grid's scroll container — scrolling it closes the pop-up. */
  scrollEl: HTMLElement | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: anchor.bottom + GAP, left: anchor.left });

  // Keep it on screen: flip above the cell when there's no room below.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    const below = anchor.bottom + GAP + h <= window.innerHeight - 8;
    setPos({
      top: below ? anchor.bottom + GAP : Math.max(8, anchor.top - GAP - h),
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8)),
    });
  }, [anchor]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    scrollEl?.addEventListener("scroll", onClose, { passive: true });
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      scrollEl?.removeEventListener("scroll", onClose);
    };
  }, [onClose, scrollEl]);

  return createPortal(
    <div
      ref={ref}
      className="jobs-stepper-pop"
      style={{ top: pos.top, left: pos.left, width: WIDTH }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`Production stage — ${title}`}
    >
      <div className="jobs-stepper-pop__head">
        <span className="jobs-stepper-pop__title">{title}</span>
        <button type="button" className="jobs-panel__x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <ProductionStepperSection jobNo={jobNo} />
    </div>,
    document.body,
  );
}
