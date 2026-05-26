import { useEffect, useState } from "react";
import type { GeoPoint } from "../types";

export function useGeolocation(): GeoPoint | undefined {
  const [point, setPoint] = useState<GeoPoint | undefined>();

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // ignore — best-effort
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return point;
}
