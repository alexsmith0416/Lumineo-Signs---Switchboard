import { useSpec } from "../../app/SpecContext";
import type { BackerType } from "../../domain/SignSpec";

const BACKER_TYPES: { value: BackerType; label: string }[] = [
  { value: "FP", label: "Flat Plex .177in White Acrylic" },
  { value: "PT", label: "Push-Through .5in Clear Acrylic" },
  { value: "CU", label: "Custom" },
];

const BACKER_COLORS = [
  "White Acrylic",
  "Clear Acrylic",
  "Matte Clear",
  "70% White Diffuser Film",
  "Custom",
];

export function Step6bRoutedBacker() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-twocol">
        <span>Backer Material</span>
        <span>Backer Tint / Diffuser</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__twocol">
          <select
            className="lum-select"
            value={spec.backerType}
            onChange={(e) => update({ backerType: (e.target.value || "") as BackerType })}
          >
            <option value="">Select…</option>
            {BACKER_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="lum-select"
            value={spec.backerColor}
            onChange={(e) => update({ backerColor: e.target.value })}
          >
            <option value="">Select…</option>
            {BACKER_COLORS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="sbp-step__notes">
        Standard: min 2&quot; letter height — ¼&quot; stroke (std) / ⅜&quot; (push-thru) — serif fonts not
        recommended at minimums — allow 3.25&quot; from cabinet edge.
      </div>
    </div>
  );
}
