import { useWeather, WEATHER_IS_LIVE, type WeatherInfo } from "../hooks/useWeather";

interface WeatherChipProps {
  zip: string | null | undefined;
  forDate: Date;
  size?: "compact" | "expanded";
}

interface WeatherView {
  icon: string;
  label: string;
  tempF: number;
  humidity: number | null;
  tint: string;
}

const TINT = {
  sun: "rgba(255, 222, 89, 0.25)",
  pcloud: "rgba(255, 222, 89, 0.18)",
  cloud: "rgba(170, 180, 200, 0.28)",
  rain: "rgba(120, 175, 230, 0.30)",
  storm: "rgba(230, 110, 110, 0.28)",
  snow: "rgba(220, 235, 250, 0.45)",
};

// Map a free-text condition ("Partly cloudy", "Light rain", …) to an icon + tint.
function iconFor(condition: string): { icon: string; tint: string } {
  const c = condition.toLowerCase();
  if (/thunder|storm/.test(c)) return { icon: "⛈️", tint: TINT.storm };
  if (/snow|sleet|ice|flurr|blizzard/.test(c)) return { icon: "❄️", tint: TINT.snow };
  if (/rain|drizzle|shower/.test(c)) return { icon: "🌧️", tint: TINT.rain };
  if (/fog|mist|haze/.test(c)) return { icon: "🌫️", tint: TINT.cloud };
  if (/overcast|cloud/.test(c)) return { icon: "☁️", tint: TINT.cloud };
  if (/partly|mostly sun|mostly clear/.test(c)) return { icon: "⛅", tint: TINT.pcloud };
  if (/sun|clear|fair/.test(c)) return { icon: "☀️", tint: TINT.sun };
  return { icon: "🌡️", tint: TINT.cloud };
}

function realToView(w: WeatherInfo): WeatherView {
  const { icon, tint } = iconFor(w.condition);
  return {
    icon,
    label: w.condition || "—",
    tempF: Math.round(w.tempF),
    humidity: w.humidity,
    tint,
  };
}

// --- Dev-only deterministic mock (used when not running live) ---------------
const MOCK_ICONS = ["☀️", "⛅", "☁️", "🌧️", "⛈️", "❄️"];
const MOCK_LABELS = ["Sunny", "Partly Cloudy", "Cloudy", "Rain", "T-Storm", "Snow"];
const MOCK_TINTS = [TINT.sun, TINT.pcloud, TINT.cloud, TINT.rain, TINT.storm, TINT.snow];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function mockView(zip: string, forDate: Date): WeatherView {
  const h = hash(`${zip}-${forDate.toDateString()}`);
  const i = h % MOCK_ICONS.length;
  return {
    icon: MOCK_ICONS[i]!,
    label: MOCK_LABELS[i]!,
    tint: MOCK_TINTS[i]!,
    tempF: 60 + (h % 35),
    humidity: 30 + ((h >> 4) % 60),
  };
}

export default function WeatherChip({ zip, forDate, size = "compact" }: WeatherChipProps) {
  const real = useWeather(zip);
  if (!zip) return null;

  // Live: use the cached forecast; hide the chip when there's no row for the ZIP
  // (don't invent data). Dev: fall back to the deterministic mock.
  const w: WeatherView | null = real
    ? realToView(real)
    : WEATHER_IS_LIVE
      ? null
      : mockView(zip, forDate);
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
        title={`${w.label} · ${w.tempF}°F${w.humidity != null ? ` · ${w.humidity}% humidity` : ""}`}
      >
        <span>{w.icon}</span>
        <span>{w.tempF}°</span>
      </span>
    );
  }

  return (
    <div style={{ padding: 10, background: w.tint, borderRadius: 6, fontSize: 12, minWidth: 200 }}>
      <div style={{ fontSize: 24 }}>{w.icon}</div>
      <div style={{ fontWeight: 600 }}>{w.label}</div>
      <div>{w.tempF}°F</div>
      {w.humidity != null && <div>{w.humidity}% humidity</div>}
    </div>
  );
}
