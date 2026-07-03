import { useEffect, useReducer } from "react";
import { getWeatherForJob, primeWeather } from "../services/weather";

// Weather chip — keyed to the job's SHIP-TO ZIP (ScheduleLine.installZip,
// which the AddJobPanel populates from BcJob.shipToZip). Data comes from
// the crfdf_weathercache Dataverse table maintained by the `Lumineo
// Weather` Power Automate flow — see src/services/weather.ts.

interface WeatherChipProps {
  zip: string | null | undefined;
  forDate: Date;
  size?: "compact" | "expanded";
}

export default function WeatherChip({ zip, forDate, size = "compact" }: WeatherChipProps) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (zip) primeWeather(zip, forDate, bump);
  }, [zip, forDate]);

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
