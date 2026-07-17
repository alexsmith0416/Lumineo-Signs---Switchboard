import type { CSSProperties } from "react";

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
  // Accent color flows through a CSS var so sizing lives in the stylesheet
  // (keeps every toolbar control the same height — see .calendar-toolbar).
  const style = accent ? ({ "--chip-accent": accent } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={"toggle-chip" + (active ? " toggle-chip--active" : "")}
      style={style}
      title={`Toggle ${label}`}
    >
      {label}
    </button>
  );
}
