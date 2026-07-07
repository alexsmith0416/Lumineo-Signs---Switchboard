import { useEffect, useState } from 'react';

// Numeric field that tolerates in-progress typing ("2.", "", "-") without
// fighting the caller's number state: it keeps a local string, commits any
// parseable value upward, and re-syncs whenever the committed value changes
// out from under it (e.g. Reset).

interface NumFieldProps {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  placeholder?: string;
  /** When set, an empty field commits null (used for "auto" overrides). */
  allowEmpty?: boolean;
  onChangeNullable?: (v: number | null) => void;
}

export function NumField({
  label,
  value,
  onChange,
  suffix,
  min,
  step,
  placeholder,
  allowEmpty,
  onChangeNullable,
}: NumFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    const current = Number(text);
    const matchesEmpty = allowEmpty && value === null && text.trim() === '';
    if (!matchesEmpty && (text.trim() === '' || !Number.isFinite(current) || current !== value)) {
      setText(value === null ? '' : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(raw: string) {
    setText(raw);
    if (raw.trim() === '') {
      if (allowEmpty) onChangeNullable?.(null);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) {
      if (allowEmpty) onChangeNullable?.(n);
      else onChange(n);
    }
  }

  return (
    <label>
      <span>{label}{suffix ? <span className="unit"> {suffix}</span> : null}</span>
      <input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        step={step ?? 'any'}
        placeholder={placeholder}
        onChange={(e) => handle(e.target.value)}
      />
    </label>
  );
}

// ── Formatting helpers shared by the results views ──────────────────────────

export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/** 6.42 ft → `6'-5"` */
export function fmtFtIn(ft: number): string {
  if (!Number.isFinite(ft) || ft < 0) return '—';
  let whole = Math.floor(ft);
  let inches = Math.round((ft - whole) * 12);
  if (inches === 12) { whole += 1; inches = 0; }
  return `${whole}'-${inches}"`;
}
