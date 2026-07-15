import { useState } from "react";
import { STANDARD_LOCATIONS } from "../services/install-meta";

const OTHER = "__other__";

/**
 * Location picker for shipment items: a dropdown of our standard locations plus
 * "Other…", which reveals a free-text box for one-off destinations (e.g.
 * "Colorado"). A value that isn't a standard location opens in Other mode with
 * the custom text prefilled.
 */
export default function LocationSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isStandard = STANDARD_LOCATIONS.includes(value);
  const [otherMode, setOtherMode] = useState(!!value && !isStandard);
  const selectVal = otherMode ? OTHER : isStandard ? value : "";

  return (
    <div className="loc-select">
      <select
        className="load-item__field"
        value={selectVal}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOtherMode(true);
            onChange(""); // clear so the custom box starts empty
          } else {
            setOtherMode(false);
            onChange(v);
          }
        }}
      >
        <option value="">Location…</option>
        {STANDARD_LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {otherMode && (
        <input
          className="load-item__field"
          type="text"
          value={value}
          autoFocus
          placeholder="Custom location"
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
