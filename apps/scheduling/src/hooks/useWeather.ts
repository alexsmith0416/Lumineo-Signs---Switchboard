import { useEffect, useState } from "react";
import { weatherByZip, type WeatherInfo } from "../services/dataverse-live";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

// The card's day as a local "yyyy-mm-dd" key (matches the flow's forecast dates).
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Live weather for an install ZIP on a specific day, read from the
 *  lum_weathercaches table (per-day forecast rows keyed by ZIP + lum_date,
 *  refreshed by WeatherCache_Refresh). Falls back to the ZIP's legacy dateless
 *  row when there's no forecast for that day. Returns null in dev/mock mode —
 *  callers fall back to the deterministic mock. */
export function useWeather(
  zip: string | null | undefined,
  forDate?: Date,
): WeatherInfo | null {
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  const dateKey = forDate ? localDateKey(forDate) : "";
  useEffect(() => {
    if (!LIVE || !zip) {
      setInfo(null);
      return;
    }
    let alive = true;
    void weatherByZip().then((m) => {
      if (!alive) return;
      const z = zip.trim();
      const dated = dateKey ? m.get(`${z}|${dateKey}`) : undefined;
      setInfo(dated ?? m.get(z) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [zip, dateKey]);
  return LIVE ? info : null;
}

export const WEATHER_IS_LIVE = LIVE;
export type { WeatherInfo };
