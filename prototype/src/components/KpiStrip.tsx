import type { Kpi } from "../types";

interface Props {
  kpis: Kpi[];
  itemWidth?: number | null;
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

// DEBUG: temporary border colors per index so we can see if all KPIs
// render and where they end up in the layout. Remove once layout works.
const DEBUG_COLORS = ["#1971c2", "#2f9e44", "#e8590c", "#9c36b5"];

export default function KpiStrip({ kpis, itemWidth }: Props) {
  return (
    <div className="kpi-grid" data-kpi-count={kpis.length}>
      {kpis.map((k, i) => {
        const isText = k.valueFormat === "text";
        const widthStyle: React.CSSProperties = itemWidth
          ? { width: `${itemWidth}px`, maxWidth: `${itemWidth}px` }
          : {};
        return (
          <div
            key={k.key}
            className="kpi"
            tabIndex={0}
            style={{
              ...widthStyle,
              outline: `3px solid ${DEBUG_COLORS[i % DEBUG_COLORS.length]}`,
            }}
          >
            <span className="kpi__label">
              [{i + 1}] {k.label}
            </span>
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
