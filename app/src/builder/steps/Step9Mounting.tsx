import { useSpec } from "../../app/SpecContext";
import { isLetter } from "../../domain/signTypes";
import type { MountingCode } from "../../domain/SignSpec";

function getOptions(signType: string): { value: MountingCode; label: string }[] {
  if (signType === "WC") {
    return [
      { value: "FM", label: "Flush Mount" },
      { value: "WB", label: "Wall / Roof Bracket" },
      { value: "FB", label: "Flag-Mount Bracket" },
    ];
  }
  if (isLetter(signType)) {
    return [
      { value: "DM", label: "Direct Mount" },
      { value: "RW", label: "Raceway" },
      { value: "RB", label: "Reverse Backer Plate" },
    ];
  }
  if (signType === "MN") {
    return [
      { value: "FM", label: "Footing Mount" },
      { value: "RM", label: "Recessed Mount" },
    ];
  }
  // PS, PP, AP, EP, EM — general cabinet mounting set.
  return [
    { value: "FM", label: "Footing Mount" },
    { value: "DM", label: "Direct Mount" },
    { value: "RM", label: "Recessed Mount" },
  ];
}

export function Step9Mounting() {
  const { spec, update } = useSpec();
  const options = getOptions(spec.signTypeCode || "");

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>9 · Mounting</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.mounting}
          onChange={(e) => update({ mounting: (e.target.value || "") as MountingCode })}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
