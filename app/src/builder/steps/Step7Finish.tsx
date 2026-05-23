import { useSpec } from "../../app/SpecContext";
import type { FinishCode } from "../../domain/SignSpec";

function getOptions(signTypeCode: string): { value: FinishCode; label: string }[] {
  if (signTypeCode === "EP") {
    return [
      { value: "OEM", label: "Pre-Painted White" },
      { value: "OEM", label: "Pre-Painted Black" },
    ];
  }
  return [
    { value: "P",   label: "Shop Painted" },
    { value: "RWB", label: "Raw / Mill Aluminum — Brushed" },
    { value: "RWM", label: "Raw / Mill Aluminum — Mill" },
    { value: "OEM", label: "OEM Pre-Finished" },
    { value: "CU",  label: "Custom…" },
  ];
}

export function Step7Finish() {
  const { spec, update } = useSpec();
  const options = getOptions(spec.signTypeCode || "");

  // The right column flips based on the chosen finish — paint color for
  // shop-painted, custom description for "Custom", hidden otherwise.
  const rightLabel =
    spec.finish === "P"  ? "Paint Color / Pantone Ref"
    : spec.finish === "CU" ? "Custom Finish Description"
    : "(Hidden)";

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-twocol">
        <span>7 · Paint / Finish</span>
        <span>{rightLabel}</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__twocol">
          <select
            className="lum-select"
            value={spec.finish}
            onChange={(e) => {
              const v = (e.target.value || "") as FinishCode;
              update({
                finish: v,
                paintColor: v === "P" ? spec.paintColor : "",
                finishCustom: v === "CU" ? spec.finishCustom : "",
              });
            }}
          >
            <option value="">Select…</option>
            {options.map((o, i) => (
              <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
            ))}
          </select>
          {spec.finish === "CU" ? (
            <input
              className="lum-input"
              placeholder="Describe the custom finish…"
              value={spec.finishCustom}
              onChange={(e) => update({ finishCustom: e.target.value })}
            />
          ) : (
            <input
              className="lum-input"
              placeholder="e.g. PMS 286 C Navy"
              value={spec.paintColor}
              onChange={(e) => update({ paintColor: e.target.value })}
              disabled={spec.finish !== "P"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
