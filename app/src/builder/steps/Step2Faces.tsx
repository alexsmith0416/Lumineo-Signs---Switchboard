import { useSpec } from "../../app/SpecContext";
import { isLetter, isPan } from "../../domain/signTypes";
import type { Faces } from "../../domain/SignSpec";

export function Step2Faces() {
  const { spec, update } = useSpec();

  // Letter types locked to N/A; pan types locked to Single Face.
  const options: { value: Faces; label: string }[] = (() => {
    if (isLetter(spec.signTypeCode || "")) return [{ value: "NA", label: "N/A" }];
    if (isPan(spec.signTypeCode || ""))    return [{ value: "SF", label: "Single Face" }];
    return [
      { value: "SF", label: "Single Face" },
      { value: "DF", label: "Double Face" },
    ];
  })();

  const locked = options.length === 1;

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>2 · Faces / Sides</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.faces}
          onChange={(e) => update({ faces: e.target.value as Faces })}
          disabled={locked}
        >
          {!locked ? <option value="">Select…</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
