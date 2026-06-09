// The navy gradient summary block at the top of the form pane. Shows the
// live product code, the live department-routing string, and the COPY
// button with the 2-second confirmation.

import { useSpec } from "../app/SpecContext";

export function SpecSummary() {
  const { spec, codeCopied, copyProductCode } = useSpec();
  if (!spec.signTypeCode) return null;

  return (
    <section className="sbp-summary" aria-label="Spec summary">
      <span className="sbp-summary__eyebrow">Live spec code</span>
      <span className="sbp-summary__code">{spec.productCode || "—"}</span>
      <div className="sbp-summary__row">
        {spec.customerName ? <span><strong>Customer:</strong>&nbsp;{spec.customerName}</span> : null}
        {spec.projectName ? <span><strong>Project:</strong>&nbsp;{spec.projectName}</span> : null}
        <span><strong>Qty:</strong>&nbsp;{spec.quantity}</span>
        {spec.departments ? <span><strong>Departments:</strong>&nbsp;{spec.departments}</span> : null}
      </div>
      <button
        type="button"
        className={"sbp-copy-btn" + (codeCopied ? " is-copied" : "")}
        onClick={copyProductCode}
        disabled={!spec.productCode}
      >
        {codeCopied ? "✓ Copied" : "Copy Code"}
      </button>
    </section>
  );
}
