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
  ];
}

export function Step7Finish() {
  const { spec, update } = useSpec();
  const options = getOptions(spec.signTypeCode || "");

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-twocol">
        <span>7 · Paint / Finish</span>
        <span>{spec.finish === "P" ? "Paint Color / Pantone Ref" : "(Paint color hidden)"}</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__twocol">
          <select
            className="lum-select"
            value={spec.finish}
            onChange={(e) => update({ finish: (e.target.value || "") as FinishCode, paintColor: e.target.value === "P" ? spec.paintColor : "" })}
          >
            <option value="">Select…</option>
            {options.map((o, i) => (
              <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            className="lum-input"
            placeholder="e.g. PMS 286 C Navy"
            value={spec.paintColor}
            onChange={(e) => update({ paintColor: e.target.value })}
            disabled={spec.finish !== "P"}
          />
        </div>
      </div>
    </div>
  );
}
