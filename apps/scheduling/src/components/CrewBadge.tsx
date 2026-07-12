import type { ScheduleLine } from "../engine/types";

interface CrewBadgeProps {
  line: ScheduleLine;
  size?: "compact" | "detail";
}

function totalCrew(line: ScheduleLine): number {
  return (line.crewPersons ?? 0) + (line.crewTrucks ?? 0) + (line.crewCranes ?? 0) + (line.crewLifts ?? 0) + (line.crewBuckets ?? 0);
}

function badgeColor(total: number): { bg: string; text: string } {
  if (total <= 2) return { bg: "rgba(74,160,93,0.18)", text: "var(--status-green)" };
  if (total <= 4) return { bg: "rgba(48,108,180,0.18)", text: "#193b6d" };
  return { bg: "rgba(218,118,18,0.18)", text: "var(--status-amber)" };
}

export default function CrewBadge({ line, size = "compact" }: CrewBadgeProps) {
  // crewPersons / crewTrucks / etc. are the crew PER trip; crewTrips is how many
  // trips the install takes.
  const parts: string[] = [];
  if (line.crewPersons) parts.push(`${line.crewPersons}M`);
  if (line.crewTrucks) parts.push(`${line.crewTrucks}T`);
  if (line.crewCranes) parts.push(`${line.crewCranes}C`);
  if (line.crewLifts) parts.push(`${line.crewLifts}L`);
  if (line.crewBuckets) parts.push(`${line.crewBuckets}B`);

  const trips = line.crewTrips ?? 0;
  if (parts.length === 0 && trips <= 0) return null;

  const perTrip = parts.join(" ");
  // Compact: "3× 4M 2T" (3 trips, 4 men + 2 trucks each). Detail spells it out.
  const label =
    trips > 0
      ? perTrip
        ? size === "detail"
          ? `${trips} trips · ${perTrip}/trip`
          : `${trips}× ${perTrip}`
        : `${trips} trips`
      : perTrip;

  const total = totalCrew(line);
  const color = badgeColor(total);
  const title =
    trips > 0
      ? `${trips} trip${trips === 1 ? "" : "s"} · ${perTrip || "crew TBD"} per trip`
      : `Crew: ${perTrip} (total ${total})`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: size === "detail" ? "2px 6px" : "1px 4px",
        background: color.bg,
        color: color.text,
        borderRadius: 3,
        fontSize: size === "detail" ? 11 : 9,
        fontWeight: 700,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
      title={title}
    >
      {label}
    </span>
  );
}
