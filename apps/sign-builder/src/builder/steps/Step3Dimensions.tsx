// H / W / D for cabinets and pans. Each column takes a paired ft + in
// input. Storage on SignSpec stays as total inches per docs/dimensions —
// the conversion happens inside DimensionInput.

import { useSpec } from "../../app/SpecContext";
import { DimensionInput } from "../../ui/DimensionInput";

export function Step3Dimensions() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head is-threecol">
        <span>3 · Height</span>
        <span>Width</span>
        <span>Depth</span>
      </div>
      <div className="sbp-step__body">
        <div className="sbp-step__threecol">
          <DimensionInput
            value={spec.heightIn}
            onChange={(v) => update({ heightIn: v })}
            ariaLabel="Height"
          />
          <DimensionInput
            value={spec.widthIn}
            onChange={(v) => update({ widthIn: v })}
            ariaLabel="Width"
          />
          <DimensionInput
            value={spec.depthIn}
            onChange={(v) => update({ depthIn: v })}
            ariaLabel="Depth"
          />
        </div>
      </div>
    </div>
  );
}
