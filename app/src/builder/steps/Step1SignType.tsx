import { useSpec } from "../../app/SpecContext";
import { SIGN_TYPES, INDOOR_ONLY } from "../../domain/signTypes";
import { Banner } from "../../ui/Banner";
import type { SignTypeCode } from "../../domain/signTypes";

export function Step1SignType() {
  const { spec, setSignType, update } = useSpec();

  return (
    <>
      <div className="sbp-step">
        <div className="sbp-step__head is-split">
          <span>1 · Sign Type</span>
          <span>Qty</span>
        </div>
        <div className="sbp-step__body">
          <div className="sbp-step__row is-split-qty">
            <select
              className="lum-select"
              value={spec.signTypeCode}
              onChange={(e) => setSignType((e.target.value as SignTypeCode) || "")}
            >
              <option value="">Select a sign type…</option>
              {SIGN_TYPES.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
            <input
              className="lum-input"
              type="number"
              min={1}
              value={spec.quantity}
              onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>
      </div>

      {spec.signTypeCode === "EP" ? (
        <Banner tone="amber">
          Pre-painted White or Black ONLY — no custom paint on Economy Pan Signs.
        </Banner>
      ) : null}

      {INDOOR_ONLY.includes(spec.signTypeCode as SignTypeCode) ? (
        <Banner tone="red">INDOOR USE ONLY — this sign type is not rated for outdoor installation.</Banner>
      ) : null}
    </>
  );
}
