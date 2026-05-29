import type { Kpi } from "../types";

interface Props {
  kpis: Kpi[];
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

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 280;
  const height = 40;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="kpi__sparkline"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="var(--lum-navy)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
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

export default function KpiStrip({ kpis }: Props) {
  return (
    <div className={`kpis ${kpis.length === 3 ? "is-3" : ""}`}>
      {kpis.map((k) => {
        const isText = k.valueFormat === "text";
        return (
          <div key={k.key} className="kpi" tabIndex={0}>
            <span className="kpi__label">{k.label}</span>
            <span className={`kpi__value ${isText ? "kpi__value--text" : ""}`}>
              {formatValue(k)}
            </span>
            <DeltaBadge k={k} />
            <Sparkline values={k.sparkline} />
          </div>
        );
      })}
    </div>
  );
}
