import { useSpec } from "../../app/SpecContext";

const TYPES = ["New Footing / Excavation", "Existing Footing"];
const METHODS = ["Auger / Caisson", "Excavated (Backhoe)", "Custom"];

export function Step11Footing() {
  const { spec, update } = useSpec();

  return (
    <div className="sbp-step">
      <div className="sbp-step__head"><span>11 · Footing</span></div>
      <div className="sbp-step__body">
        <select
          className="lum-select"
          value={spec.footingType}
          onChange={(e) => {
            const v = e.target.value;
            update({
              footingType: v,
              ...(v === "New Footing / Excavation" ? {} : { footingDepth: "", footingMethod: "" }),
            });
          }}
        >
          <option value="">Select…</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {spec.footingType === "New Footing / Excavation" ? (
          <div className="sbp-step__twocol" style={{ marginTop: 14, gridTemplateColumns: "1fr 2fr" }}>
            <div>
              <span className="lum-field-label">Depth (in)</span>
              <input
                className="lum-input"
                inputMode="decimal"
                value={spec.footingDepth}
                onChange={(e) => update({ footingDepth: e.target.value })}
                placeholder="e.g. 48"
              />
            </div>
            <div>
              <span className="lum-field-label">Method</span>
              <select
                className="lum-select"
                value={spec.footingMethod}
                onChange={(e) => update({ footingMethod: e.target.value })}
              >
                <option value="">Select…</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
