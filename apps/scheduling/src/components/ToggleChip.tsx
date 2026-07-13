/** A small on/off pill used in calendar toolbars (e.g. the $ / weather toggles). */
export default function ToggleChip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  const activeBg = accent ?? "var(--lumineo-navy)";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 9px",
        fontSize: 12,
        fontWeight: 600,
        background: active ? activeBg : "#fff",
        color: active ? "#fff" : activeBg,
        border: `1px solid ${activeBg}`,
        borderRadius: 5,
        cursor: "pointer",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
      title={`Toggle ${label}`}
    >
      {label}
    </button>
  );
}
