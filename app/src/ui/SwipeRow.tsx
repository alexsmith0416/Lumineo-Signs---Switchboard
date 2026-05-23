// SwipeRow — touch / pointer-drag wrapper that reveals action buttons
// when the foreground is swiped left. Used in the Gallery on mobile so
// Duplicate / Delete are tucked behind each row instead of cluttering it.
//
// Desktop falls back to rendering actions inline next to the row — the
// SwipeRow itself stays neutral and inherits behavior from CSS media
// queries (see .sbp-swiperow rules).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SwipeAction = {
  label: string;
  tone: "neutral" | "danger";
  onClick: () => void;
};

type Props = {
  /** Tap-to-open behavior on the row body. */
  onActivate?: () => void;
  /** Buttons revealed when the row is swiped left. */
  actions: SwipeAction[];
  /** Visual width of the revealed area in px. Default 160. */
  revealWidth?: number;
  children: ReactNode;
};

export function SwipeRow({ onActivate, actions, revealWidth = 160, children }: Props) {
  const [tx, setTx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const dragRef = useRef<{ startX: number; startTx: number; moved: boolean } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close when the user taps anywhere else on the page.
  useEffect(() => {
    if (!revealed) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setRevealed(false);
        setTx(0);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [revealed]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only respond to primary mouse button or touch.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startTx: revealed ? -revealWidth : 0,
      moved: false,
    };
  }, [revealed, revealWidth]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (Math.abs(dx) > 5) drag.moved = true;
    // Clamp between fully revealed and closed.
    const next = Math.max(-revealWidth, Math.min(0, drag.startTx + dx));
    setTx(next);
  }, [revealWidth]);

  const onPointerUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    // If the foreground passed the halfway mark, snap to revealed.
    if (tx < -revealWidth / 2) {
      setRevealed(true);
      setTx(-revealWidth);
    } else {
      setRevealed(false);
      setTx(0);
    }
  }, [tx, revealWidth]);

  function handleBodyClick() {
    // Skip the navigate if the click was actually the end of a drag, or if
    // the row is currently revealed (in which case the tap should close it).
    if (dragRef.current?.moved) return;
    if (revealed) {
      setRevealed(false);
      setTx(0);
      return;
    }
    onActivate?.();
  }

  return (
    <div className="sbp-swiperow" ref={rowRef}>
      <div className="sbp-swiperow__actions" style={{ width: revealWidth }}>
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            className={"sbp-swiperow__action" + (a.tone === "danger" ? " is-danger" : "")}
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(false);
              setTx(0);
              a.onClick();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="sbp-swiperow__body"
        style={{ transform: `translateX(${tx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleBodyClick}
      >
        {children}
      </div>
    </div>
  );
}
