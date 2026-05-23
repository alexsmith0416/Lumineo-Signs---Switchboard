import { useSpec } from "../../app/SpecContext";
import type { FaceTypeCode } from "../../domain/SignSpec";

// Face type options vary by sign type. Letters get a much shorter list.
function getOptions(signType: string): { value: FaceTypeCode; label: string }[] {
  const isLetter = ["FL", "HL", "CL", "AL", "CA", "PL", "AC"].includes(signType);
  if (isLetter) {
    return [
      { value: "AT", label: "Aluminum Trim Cap (Letter standard)" },
      { value: "PT", label: "Plex Face / Trim Cap" },
      { value: "CU", label: "Custom…" },
    ];
  }
  if (signType === "EM") {
    return [{ value: "EM", label: "EMC LED Panel" }];
  }
  return [
    { value: "AT",   label: "Aluminum (Routed / Cabinet)" },
    { value: "PT",   label: "Plex Face" },
    { value: "RFPB", label: "Routed Face — Push-Back Backer" },
    { value: "RFPT", label: "Routed Face — Push-Through" },
    { value: "DF",   label: "Direct Print / Digital Face" },
    { value: "CU",   label: "Custom…" },
  ];
}

export function Step6FaceType() {
  const { spec, setFaceType, update } = useSpec();
  const options = getOptions(spec.signTypeCode || "");

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>6 · Face Type</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.faceType}
          onChange={(e) => setFaceType((e.target.value || "") as FaceTypeCode)}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {spec.faceType === "CU" ? (
          <input
            className="lum-input"
            style={{ marginTop: 10 }}
            value={spec.faceTypeCustom}
            onChange={(e) => update({ faceTypeCustom: e.target.value })}
            placeholder="Describe the custom face type…"
          />
        ) : null}
      </div>
    </div>
  );
}
