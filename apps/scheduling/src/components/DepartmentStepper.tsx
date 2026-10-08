import React from "react";

/**
 * Continuous-line department stepper (ported from the Lumineo design package).
 *
 * Visual grammar — color is attention:
 *   • included  (upcoming)  → solid navy
 *   • active    (now)       → red, enlarged, gentle glow
 *   • completed (moved on)  → faint outline
 * The connector leaving a completed node fades; the road ahead stays solid navy,
 * so the line doubles as a progress bar. Styles live in lumineo.css (.lum-stepper*).
 */
export type DepartmentState = "included" | "active" | "completed";

export interface DepartmentStep {
  /** Short code shown inside the node, e.g. "MF". Also the React key. */
  key: string;
  /** Full department name for tooltips / screen readers. */
  label: string;
  state: DepartmentState;
}

const STATE_VERB: Record<DepartmentState, string> = {
  included: "not started",
  active: "working now",
  completed: "completed",
};

export default function DepartmentStepper({
  steps,
  size = "md",
  onNodeClick,
  selectedKey,
}: {
  steps: DepartmentStep[];
  size?: "sm" | "md";
  /** When set, each node is a button (clicking selects it to act on). */
  onNodeClick?: (step: DepartmentStep) => void;
  /** The currently-selected node key — rendered with the yellow-orange glow. */
  selectedKey?: string | null;
}): React.ReactElement {
  if (!steps || steps.length === 0) {
    return (
      <span className="lum-stepper-empty" aria-label="No departments">
        &mdash;
      </span>
    );
  }
  return (
    <div className={`lum-stepper lum-stepper--${size}`} role="list" aria-label="Department progress">
      {steps.map((step, i) => {
        const barFilled = i > 0 && steps[i - 1].state !== "completed";
        const title = `${step.label} — ${STATE_VERB[step.state]}`;
        const sel = selectedKey === step.key ? " is-selected" : "";
        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <span className={`lum-stepper__bar${barFilled ? " is-filled" : ""}`} aria-hidden="true" />
            )}
            {onNodeClick ? (
              <button
                type="button"
                role="listitem"
                className={`lum-stepper__node lum-stepper__node--btn is-${step.state}${sel}`}
                title={title}
                aria-label={title}
                aria-pressed={selectedKey === step.key}
                onClick={() => onNodeClick(step)}
              >
                {step.key}
              </button>
            ) : (
              <span
                role="listitem"
                className={`lum-stepper__node is-${step.state}${sel}`}
                title={title}
                aria-label={title}
              >
                {step.key}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
