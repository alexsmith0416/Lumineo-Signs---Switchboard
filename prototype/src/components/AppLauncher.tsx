import type { AppTile, Role } from "../types";

interface Props {
  tiles: AppTile[];
  role: Role;
  itemWidth?: number | null;
  cols?: number;
}

export default function AppLauncher({ tiles, role, itemWidth, cols = 2 }: Props) {
  const visible = tiles.filter((t) => t.audience.includes(role));
  const gridStyle: React.CSSProperties = itemWidth
    ? {
        display: "grid",
        gridTemplateColumns: Array(cols).fill(`${itemWidth}px`).join(" "),
        gap: "8px",
      }
    : {};
  return (
    <>
      <div className="section-label">Apps</div>
      <div className="applauncher" style={gridStyle}>
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`apptile ${!t.enabled ? "is-disabled" : ""}`}
            disabled={!t.enabled}
            title={`Launch ${t.label}`}
            onClick={() => {
              if (t.enabled) window.open(t.targetUrl, "_blank", "noopener");
            }}
          >
            <span className="apptile__emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="apptile__label">{t.label}</span>
            {t.badgeText && <span className="apptile__badge">{t.badgeText}</span>}
          </button>
        ))}
      </div>
    </>
  );
}
