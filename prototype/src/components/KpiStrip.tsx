import type { Kpi } from "../types";

interface Props {
  kpis: Kpi[];
  itemWidth?: number | null;
  cols?: number;
}

function formatValue(k: Kpi): string {
  if (k.valueFormat === "text") return k.textValue ?? "—";
  if (k.valueFormat === "currency") {
    return "$" + k.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (k.valueFormat === "hours") return k.value.toLocaleString() + "h";
  if (k.valueFormat === "percent") return k.value + "%";
  return k.value.toLocaleString();
}

function DeltaBadge({ k }: { k: Kpi }) {
  if (!k.deltaDirection || k.valueFormat === "text") return null;
  const arrow = k.deltaDirection === "up" ? "▲" : k.deltaDirection === "down" ? "▼" : "▬";
  const cls =
    k.deltaDirection === "flat"
      ? "is-flat"
      : k.deltaIsGood
        ? "is-good"
        : "is-bad";
  const suffix = k.delta == null ? "" : `${k.delta}${k.valueFormat === "percent" ? "pp" : "%"}`;
  return (
    <span className={`kpi__delta ${cls}`}>
      {arrow} {suffix}
    </span>
  );
}

export default function KpiStrip({ kpis, itemWidth, cols = 2 }: Props) {
  // Force a real N-col grid via inline style with explicit pixel template.
  // Grid auto-placement automatically creates new rows when items overflow
  // the explicit columns.
  const gridStyle: React.CSSProperties = itemWidth
    ? {
        display: "grid",
        gridTemplateColumns: Array(cols).fill(`${itemWidth}px`).join(" "),
        gap: "8px",
      }
    : {};
  return (
    <div className="kpi-grid" style={gridStyle}>
      {kpis.map((k) => {
        const isText = k.valueFormat === "text";
        return (
          <div key={k.key} className="kpi" tabIndex={0}>
            <span className="kpi__label">{k.label}</span>
            <span className={`kpi__value ${isText ? "kpi__value--text" : ""}`}>
              {formatValue(k)}
            </span>
            <DeltaBadge k={k} />
          </div>
        );
      })}
    </div>
  );
}
