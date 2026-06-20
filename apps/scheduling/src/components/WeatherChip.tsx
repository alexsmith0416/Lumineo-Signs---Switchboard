interface WeatherChipProps {
  zip: string | null | undefined;
  forDate: Date;
  size?: "compact" | "expanded";
}

interface WeatherData {
  icon: string;
  label: string;
  tempHigh: number;
  tempLow: number;
  precipPct: number;
  windMph: number;
  alert: string | null;
  tint: string;
}

// STUB: deterministic fake weather keyed off (zip, date). Replace with the
// `Lumineo Weather` Power Automate connector once it's deployed (see
// docs/09-weather-card-spec.md). The signature below — `(zip, forDate) →
// WeatherData` — is what the real impl needs to match.
const ICONS = ["☀️", "🌤️", "⛅", "☁️", "🌧️", "⛈️", "❄️"];
const LABELS = ["Sunny", "Mostly Sunny", "Partly Cloudy", "Cloudy", "Rain", "T-Storm", "Snow"];
const TINTS = [
  "rgba(255, 222, 89, 0.25)",
  "rgba(255, 222, 89, 0.18)",
  "rgba(180, 200, 220, 0.20)",
  "rgba(170, 180, 200, 0.28)",
  "rgba(120, 175, 230, 0.30)",
  "rgba(230, 110, 110, 0.28)",
  "rgba(220, 235, 250, 0.45)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getMockWeather(zip: string, forDate: Date): WeatherData {
  const key = `${zip}-${forDate.toDateString()}`;
  const h = hash(key);
  const condIdx = h % ICONS.length;
  const baseTemp = 55 + (h % 35);
  return {
    icon: ICONS[condIdx]!,
    label: LABELS[condIdx]!,
    tint: TINTS[condIdx]!,
    tempHigh: baseTemp + 8,
    tempLow: baseTemp - 8,
    precipPct: condIdx >= 4 ? 50 + ((h >> 4) % 40) : (h % 20),
    windMph: 5 + ((h >> 8) % 18),
    alert: condIdx === 5 ? "Wind gusts >25 mph" : null,
  };
}

export default function WeatherChip({ zip, forDate, size = "compact" }: WeatherChipProps) {
  if (!zip) return null;
  const w = getMockWeather(zip, forDate);

  if (size === "compact") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: "1px 5px",
          background: w.tint,
          borderRadius: 3,
          fontSize: 10,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
        title={`${w.label} · H ${w.tempHigh}° / L ${w.tempLow}° · ${w.precipPct}% precip · wind ${w.windMph} mph${w.alert ? `\n⚠ ${w.alert}` : ""}`}
      >
        <span>{w.icon}</span>
        <span>{w.tempHigh}°</span>
        {w.alert && <span style={{ color: "var(--lumineo-red)" }}>⚠</span>}
      </span>
    );
  }

  return (
    <div
      style={{
        padding: 10,
        background: w.tint,
        borderRadius: 6,
        fontSize: 12,
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 24 }}>{w.icon}</div>
      <div style={{ fontWeight: 600 }}>{w.label}</div>
      <div>H {w.tempHigh}°F / L {w.tempLow}°F</div>
      <div>{w.precipPct}% precip · wind {w.windMph} mph</div>
      {w.alert && (
        <div style={{ color: "var(--lumineo-red)", marginTop: 4 }}>
          ⚠ {w.alert}
        </div>
      )}
    </div>
  );
}
