import { useSpec } from "../../app/SpecContext";
import { isLetter } from "../../domain/signTypes";
import type { MountingCode } from "../../domain/SignSpec";

function getOptions(signType: string): { value: MountingCode; label: string }[] {
  const custom = { value: "CU" as MountingCode, label: "Custom…" };
  if (signType === "WC") {
    return [
      { value: "FM", label: "Flush Mount" },
      { value: "WB", label: "Wall / Roof Bracket" },
      { value: "FB", label: "Flag-Mount Bracket" },
      custom,
    ];
  }
  if (isLetter(signType)) {
    return [
      { value: "DM", label: "Direct Mount" },
      { value: "RW", label: "Raceway" },
      { value: "RB", label: "Reverse Backer Plate" },
      custom,
    ];
  }
  if (signType === "MN") {
    return [
      { value: "FM", label: "Footing Mount" },
      { value: "RM", label: "Recessed Mount" },
      custom,
    ];
  }
  // PS, PP, AP, EP, EM — general cabinet mounting set.
  return [
    { value: "FM", label: "Footing Mount" },
    { value: "DM", label: "Direct Mount" },
    { value: "RM", label: "Recessed Mount" },
    custom,
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
          onChange={(e) => {
            const v = (e.target.value || "") as MountingCode;
            update({ mounting: v, mountingCustom: v === "CU" ? spec.mountingCustom : "" });
          }}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {spec.mounting === "CU" ? (
          <input
            className="lum-input"
            style={{ marginTop: 10 }}
            value={spec.mountingCustom}
            onChange={(e) => update({ mountingCustom: e.target.value })}
            placeholder="Describe the custom mounting method…"
          />
        ) : null}
      </div>
    </div>
  );
}
