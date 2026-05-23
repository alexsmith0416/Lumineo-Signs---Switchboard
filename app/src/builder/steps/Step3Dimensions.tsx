import { useSpec } from "../../app/SpecContext";

// H/W/D — hidden for letter types; cabinet/pan/EMC only.
export function Step3Dimensions() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-threecol">
        <span>3 · Height (in)</span>
        <span>Width (in)</span>
        <span>Depth (in)</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__threecol">
          <input
            className="lum-input"
            placeholder="H"
            inputMode="decimal"
            value={spec.heightIn}
            onChange={(e) => update({ heightIn: e.target.value })}
          />
          <input
            className="lum-input"
            placeholder="W"
            inputMode="decimal"
            value={spec.widthIn}
            onChange={(e) => update({ widthIn: e.target.value })}
          />
          <input
            className="lum-input"
            placeholder="D"
            inputMode="decimal"
            value={spec.depthIn}
            onChange={(e) => update({ depthIn: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
