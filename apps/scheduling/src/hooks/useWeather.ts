import { useEffect, useState } from "react";
import { weatherByZip, type WeatherInfo } from "../services/dataverse-live";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Live current weather for an install ZIP, read from the lum_weathercaches
 *  table (keyed by lum_location = ZIP, refreshed by WeatherCache_Refresh).
 *  Returns null in dev/mock mode — callers fall back to the deterministic mock. */
export function useWeather(zip: string | null | undefined): WeatherInfo | null {
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  useEffect(() => {
    if (!LIVE || !zip) {
      setInfo(null);
      return;
    }
    let alive = true;
    void weatherByZip().then((m) => {
      if (alive) setInfo(m.get(zip.trim()) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [zip]);
  return LIVE ? info : null;
}

export const WEATHER_IS_LIVE = LIVE;
export type { WeatherInfo };
