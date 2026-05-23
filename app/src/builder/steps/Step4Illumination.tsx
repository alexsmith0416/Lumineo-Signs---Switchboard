import { useSpec } from "../../app/SpecContext";
import type { Illumination } from "../../domain/SignSpec";

export function Step4Illumination() {
  const { spec, setIllumination } = useSpec();

  // EMC: forced internal. Pan types: forced non-illuminated.
  const t = spec.signTypeCode;
  const options: { value: Illumination; label: string }[] = (() => {
    if (t === "EM")                 return [{ value: "IL", label: "Internally Illuminated" }];
    if (t === "AP" || t === "EP" || t === "PP") return [{ value: "NI", label: "Non-Illuminated" }];
    return [
      { value: "IL", label: "Internally Illuminated" },
      { value: "EL", label: "Externally Illuminated" },
      { value: "NI", label: "Non-Illuminated" },
    ];
  })();

  const locked = options.length === 1;

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>4 · Illumination</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.illumination}
          onChange={(e) => setIllumination((e.target.value || "") as Illumination)}
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
