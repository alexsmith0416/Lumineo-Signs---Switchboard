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

// ── Feet + inches paired field ───────────────────────────────────────────────
// Commits a single decimal-feet value while letting the user type feet and
// inches separately (10' 6" ↔ 10.5). Same in-progress-typing tolerance as
// NumField; re-syncs when the committed value changes externally (Reset).

function splitFtIn(value: number): { ft: string; in: string } {
  if (!Number.isFinite(value)) return { ft: '', in: '' };
  let ft = Math.floor(value + 1e-9);
  let inches = Math.round((value - ft) * 12 * 100) / 100;
  if (inches >= 12) { ft += 1; inches -= 12; }
  return { ft: String(ft), in: inches === 0 ? '0' : String(inches) };
}

function joinFtIn(ftText: string, inText: string): number | null {
  const ft = ftText.trim() === '' ? 0 : Number(ftText);
  const inches = inText.trim() === '' ? 0 : Number(inText);
  if (!Number.isFinite(ft) || !Number.isFinite(inches)) return null;
  return ft + inches / 12;
}

interface FtInFieldProps {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  /** When set, both boxes empty commits null (used for "auto" overrides). */
  allowEmpty?: boolean;
  onChangeNullable?: (v: number | null) => void;
  placeholder?: string;
}

export function FtInField({ label, value, onChange, allowEmpty, onChangeNullable, placeholder }: FtInFieldProps) {
  const initial = value === null ? { ft: '', in: '' } : splitFtIn(value);
  const [ftText, setFtText] = useState(initial.ft);
  const [inText, setInText] = useState(initial.in);

  useEffect(() => {
    const bothEmpty = ftText.trim() === '' && inText.trim() === '';
    if (value === null) {
      if (!(allowEmpty && bothEmpty)) { setFtText(''); setInText(''); }
      return;
    }
    const current = bothEmpty ? null : joinFtIn(ftText, inText);
    if (current === null || Math.abs(current - value) > 1e-9) {
      const s = splitFtIn(value);
      setFtText(s.ft);
      setInText(s.in);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(nextFt: string, nextIn: string) {
    if (allowEmpty && nextFt.trim() === '' && nextIn.trim() === '') {
      onChangeNullable?.(null);
      return;
    }
    const joined = joinFtIn(nextFt, nextIn);
    if (joined !== null) {
      if (allowEmpty) onChangeNullable?.(joined);
      else onChange(joined);
    }
  }

  return (
    <label>
      <span>{label}</span>
      <span className="ftin">
        <span className="ftin-part">
          <input
            type="number"
            inputMode="decimal"
            value={ftText}
            min={0}
            step="any"
            placeholder={placeholder ?? '0'}
            aria-label={`${label} feet`}
            onChange={(e) => { setFtText(e.target.value); commit(e.target.value, inText); }}
          />
          <span className="ftin-suffix">ft</span>
        </span>
        <span className="ftin-part">
          <input
            type="number"
            inputMode="decimal"
            value={inText}
            min={0}
            step="any"
            placeholder="0"
            aria-label={`${label} inches`}
            onChange={(e) => { setInText(e.target.value); commit(ftText, e.target.value); }}
          />
          <span className="ftin-suffix">in</span>
        </span>
      </span>
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
