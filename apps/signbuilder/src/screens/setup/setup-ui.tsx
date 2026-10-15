import { useEffect, useState } from "react";
import type { SetupData } from "../../domain/types";

/** Category → sign type pickers (blocks listed at the end). */
export function TypePicker({ setup, typeCode, onChange }: { setup: SetupData; typeCode: string; onChange: (code: string) => void }) {
  const current = setup.signTypes.find((t) => t.code === typeCode);
  const categories = [...setup.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const [cat, setCat] = useState(current?.categoryCode ?? categories[0]?.code ?? "");
  useEffect(() => {
    if (current && current.categoryCode !== cat) setCat(current.categoryCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeCode]);
  const types = setup.signTypes
    .filter((t) => t.categoryCode === cat && !t.isBlock)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  useEffect(() => {
    if (!types.some((t) => t.code === typeCode) && types[0]) onChange(types[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);
  return (
    <div className="sbp-grid-fields" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
      <div className="sbp-field">
        <label>Category</label>
        <select className="sbp-input" value={cat} onChange={(e) => setCat(e.target.value)}>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.description}
              {c.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </div>
      <div className="sbp-field">
        <label>Sign type</label>
        <select className="sbp-input" value={typeCode} onChange={(e) => onChange(e.target.value)}>
          {types.map((t) => (
            <option key={t.code} value={t.code}>
              {t.description} ({t.code}){t.active ? "" : " – inactive"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** A text box that saves when you leave it (or press Enter), not per keystroke. */
export function CommitInput({
  value,
  onCommit,
  placeholder,
  className = "sbp-input",
  style,
  multiline = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  if (multiline) {
    return <textarea className={className} style={style} value={v} placeholder={placeholder} rows={2} onChange={(e) => setV(e.target.value)} onBlur={commit} />;
  }
  return (
    <input
      className={className}
      style={style}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value);
      }}
    />
  );
}
