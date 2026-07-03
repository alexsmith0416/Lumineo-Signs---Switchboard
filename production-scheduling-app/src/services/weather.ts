// Weather for a job's ship-to ZIP — read from the crfdf_weathercache
// Dataverse table. A Power Automate flow (`Lumineo Weather`) refreshes the
// cache from OpenWeatherMap every 6 hours for every distinct ship-to ZIP
// on the coming two weeks of schedule lines (docs/09-weather-card-spec.md).
// The app only ever reads the cache — no OpenWeatherMap key ships in the
// client bundle.

import { getDataverseReader, dateOrNull, num, str } from "./dataverse-reader";

export interface WeatherData {
  icon: string;
  label: string;
  tempHigh: number;
  tempLow: number;
  precipPct: number;
  windMph: number;
  alert: string | null;
  tint: string;
}

const T_WEATHER_CACHE = "crfdf_weathercache";

// Map the flow's condition code to chip visuals. Tints stay light so the
// dept card colors still dominate.
const CONDITION_META: Record<string, { icon: string; tint: string }> = {
  clear: { icon: "☀️", tint: "#FFF7DB" },
  clouds: { icon: "⛅", tint: "#EEF1F5" },
  rain: { icon: "🌧", tint: "#DCE9F7" },
  drizzle: { icon: "🌦", tint: "#DCE9F7" },
  thunderstorm: { icon: "⛈", tint: "#E3DCF7" },
  snow: { icon: "❄️", tint: "#EAF4FB" },
  mist: { icon: "🌫", tint: "#ECEEF0" },
  fog: { icon: "🌫", tint: "#ECEEF0" },
  wind: { icon: "💨", tint: "#E8F1EC" },
};

const cache = new Map<string, WeatherData | null>();
const inflight = new Map<string, Promise<WeatherData | null>>();

function cacheKey(zip: string, forDate: Date): string {
  return `${zip.slice(0, 5)}|${forDate.toISOString().slice(0, 10)}`;
}

export async function getWeatherForJobAsync(
  zip: string,
  forDate: Date,
): Promise<WeatherData | null> {
  const key = cacheKey(zip, forDate);
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const p = (async () => {
    const day = forDate.toISOString().slice(0, 10);
    const rows = await getDataverseReader().retrieveMultiple(T_WEATHER_CACHE, {
      filter: `crfdf_zip eq '${zip.slice(0, 5)}' and crfdf_forecastdate eq ${day}`,
      top: 1,
    });
    const row = rows[0];
    let data: WeatherData | null = null;
    if (row) {
      const condition = str(row, "crfdf_condition", "condition").toLowerCase();
      const meta = CONDITION_META[condition] ?? { icon: "🌡", tint: "#EEF1F5" };
      const fetchedAt = dateOrNull(row, "crfdf_fetchedat", "fetchedAt");
      // Treat rows older than 12h as stale-but-usable; the flow's 6h cycle
      // normally keeps this fresh. Rows older than 48h are dropped.
      const ageMs = fetchedAt ? Date.now() - fetchedAt.getTime() : 0;
      if (ageMs < 48 * 3600 * 1000) {
        data = {
          icon: meta.icon,
          tint: meta.tint,
          label: str(row, "crfdf_label", "label") || condition,
          tempHigh: Math.round(num(row, "crfdf_temphigh", "tempHigh")),
          tempLow: Math.round(num(row, "crfdf_templow", "tempLow")),
          precipPct: Math.round(num(row, "crfdf_precippct", "precipPct")),
          windMph: Math.round(num(row, "crfdf_windmph", "windMph")),
          alert: str(row, "crfdf_alert", "alert") || null,
        };
      }
    }
    cache.set(key, data);
    inflight.delete(key);
    return data;
  })();
  inflight.set(key, p);
  return p;
}

/** Sync cache read — returns null until the async fetch resolves. */
export function getWeatherForJob(zip: string, forDate: Date): WeatherData | null {
  const key = cacheKey(zip, forDate);
  const cached = cache.get(key);
  if (cached === undefined) {
    void getWeatherForJobAsync(zip, forDate);
    return null;
  }
  return cached;
}

/** Subscribe helper for React — resolves then triggers the callback so the
 *  component can re-render with the cached value. */
export function primeWeather(zip: string, forDate: Date, onReady: () => void): void {
  const key = cacheKey(zip, forDate);
  if (cache.has(key)) return;
  void getWeatherForJobAsync(zip, forDate).then(() => onReady());
}
