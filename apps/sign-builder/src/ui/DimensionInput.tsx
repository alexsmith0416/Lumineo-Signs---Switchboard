// Paired ft / in input that reads + writes a single total-inches string on
// the SignSpec. Two textboxes side by side with subtle "ft" / "in" suffix
// labels. The user types one number per box; this component handles the
// math so the parent never has to convert.

import { useEffect, useState } from "react";
import { joinFtIn, splitFtIn } from "../domain/dimensions";

type Props = {
  /** Total inches, as a string. Empty string when the field is blank. */
  value: string;
  /** Called whenever ft or in changes; emits the new total-inches string. */
  onChange: (totalInches: string) => void;
  /** Optional accessible label for the whole pair. */
  ariaLabel?: string;
  /** Mark the inputs disabled (cascade reset, locked steps, etc.). */
  disabled?: boolean;
};

export function DimensionInput({ value, onChange, ariaLabel, disabled }: Props) {
  const initial = splitFtIn(value);
  const [ft, setFt] = useState(initial.ft);
  const [inches, setIn] = useState(initial.in);

  // Resync the local boxes when the parent's value changes for reasons
  // other than this component (cascade reset, deep-link load). Compare on
  // joined total so user-mid-typing doesn't get clobbered each render.
  useEffect(() => {
    const local = joinFtIn(ft, inches);
    if (local !== value) {
      const next = splitFtIn(value);
      setFt(next.ft);
      setIn(next.in);
    }
    // Deliberately watching `value` only — local state changes already
    // round-trip through onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function update(nextFt: string, nextIn: string) {
    setFt(nextFt);
    setIn(nextIn);
    onChange(joinFtIn(nextFt, nextIn));
  }

  return (
    <div className="sbp-dim-input" role="group" aria-label={ariaLabel}>
      <div className="sbp-dim-input__pair">
        <input
          type="text"
          inputMode="decimal"
          className="sbp-dim-input__field"
          placeholder="0"
          value={ft}
          onChange={(e) => update(e.target.value, inches)}
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel} feet` : "feet"}
        />
        <span className="sbp-dim-input__unit">ft</span>
      </div>
      <div className="sbp-dim-input__pair">
        <input
          type="text"
          inputMode="decimal"
          className="sbp-dim-input__field"
          placeholder="0"
          value={inches}
          onChange={(e) => update(ft, e.target.value)}
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel} inches` : "inches"}
        />
        <span className="sbp-dim-input__unit">in</span>
      </div>
    </div>
  );
}
