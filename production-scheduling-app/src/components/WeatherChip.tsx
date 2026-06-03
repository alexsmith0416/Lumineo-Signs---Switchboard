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

// M1 scaffold: NOT WIRED. M10 replaces this with a call through the
// `Lumineo Weather` Power Automate connector + `WeatherCache` Dataverse
// table (docs/09-weather-card-spec.md). The signature is the contract — a
// real impl returns the same `WeatherData` shape (or null while loading).
const WARN_KEY = "__lumineo_stub_warned_weather__";

function warnOnce(): void {
  const g = globalThis as Record<string, unknown>;
  if (g[WARN_KEY]) return;
  g[WARN_KEY] = true;
  console.warn(
    "[stub] WeatherChip data source is not wired yet (M10). " +
      "Replace getWeatherForJob in src/components/WeatherChip.tsx with a " +
      "call to the `Lumineo Weather` Power Automate flow.",
  );
}

function getWeatherForJob(_zip: string, _forDate: Date): WeatherData | null {
  warnOnce();
  return null;
}

export default function WeatherChip({ zip, forDate, size = "compact" }: WeatherChipProps) {
  if (!zip) return null;
  const w = getWeatherForJob(zip, forDate);
  if (!w) return null;

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
