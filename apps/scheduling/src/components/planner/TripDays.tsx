import { clock, dayMapsUrl, duration, type SavedTrip } from "../../services/saved-trips";
import type { TripEvent } from "../../services/trip-plan";

type TripLike = Pick<SavedTrip, "home" | "stops" | "plan" | "startHour" | "source">;

const hrs = (h: number) => (Math.round(h * 10) / 10).toString();
/** A drive under a minute (next door / same spot) isn't worth a line. */
const trivial = (e: TripEvent) => e.type === "drive" && e.hours * 60 < 1;
/** A stop's number in driving order (1 = first stop) — matches the map. */
const stopNo = (order: readonly number[], stop: number) => order.indexOf(stop) + 1;

/** A trip's totals line: "2 days · 1 night · 5 h 10 m driving (312 mi) · 14 h work". */
export function TripTotals({ trip }: { trip: TripLike }) {
  const p = trip.plan;
  return (
    <div className="tr-totals">
      <b>
        {p.days.length} day{p.days.length === 1 ? "" : "s"}
      </b>
      {p.nights > 0 && (
        <span className="pl-badge pl-badge--night">
          {p.nights} night{p.nights === 1 ? "" : "s"}
        </span>
      )}
      <span>
        {duration(p.driveHours)} driving ({Math.round(p.miles)} mi)
      </span>
      <span>{hrs(p.workHours)} h on site</span>
      <span className="tr-source">{trip.source === "road" ? "Road drive times" : "Estimated drive times"}</span>
    </div>
  );
}

/**
 * A trip day by day: when the crew leaves, each drive (time + miles) and job
 * (hours, "part 1 of 2" when it carries over), where they end the day (home,
 * or a night near the last stop), and a Google Maps link per day.
 */
export default function TripDays({ trip }: { trip: TripLike }) {
  const name = (i: number) => (i === 0 ? trip.home.name : `${trip.stops[i - 1]!.jobNo} ${trip.stops[i - 1]!.name}`);
  return (
    <div className="tr-days">
      {trip.plan.warnings.map((w) => (
        <div key={w} className="tr-warn">
          ⚠ {w}
        </div>
      ))}
      {trip.plan.days.map((d, di) => {
        let t = trip.startHour;
        const url = dayMapsUrl(trip, di);
        const from = di === 0 || trip.plan.days[di - 1]!.endsAt === "home" ? trip.home.name : name(trip.plan.days[di - 1]!.endsAt as number);
        return (
          <section key={d.day} className="tr-day">
            <header className="tr-day__head">
              <b>Day {d.day}</b>
              <span>
                {duration(d.driveHours)} driving · {hrs(d.workHours)} h work
              </span>
              {url && (
                <a className="tr-day__maps" href={url} target="_blank" rel="noopener noreferrer">
                  Google Maps
                </a>
              )}
            </header>
            <ol className="tr-steps">
              <li className="tr-step tr-step--leave">
                <span className="tr-time">{clock(t)}</span> Leave {from}
              </li>
              {d.events.map((e: TripEvent, i) => {
                const at = t;
                t += e.hours;
                if (trivial(e)) return null;
                if (e.type === "drive") {
                  return (
                    <li key={i} className="tr-step tr-step--drive">
                      <span className="tr-time" />
                      Drive {duration(e.hours)} · {Math.round(e.miles)} mi → {e.to === 0 ? trip.home.name : trip.stops[e.to - 1]!.jobNo}
                    </li>
                  );
                }
                const s = trip.stops[e.stop - 1]!;
                return (
                  <li key={i} className="tr-step tr-step--work">
                    <span className="tr-time">{clock(at)}</span>
                    <span className="tr-stop">{stopNo(trip.plan.order, e.stop)}</span>
                    <b>{s.jobNo}</b> {s.name} · {hrs(e.hours)} h{s.kind === "service" ? " service" : ""}
                    {e.parts > 1 && (
                      <span className="tr-part">
                        {" "}
                        (part {e.part} of {e.parts})
                      </span>
                    )}
                    {s.address && <div className="tr-addr">{s.address}</div>}
                  </li>
                );
              })}
              <li className="tr-step tr-step--end">
                <span className="tr-time">{clock(t)}</span>{" "}
                {d.endsAt === "home" ? `Back at ${trip.home.name}` : `Night near ${name(d.endsAt)}`}
              </li>
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** The printable trip sheet's markup (for printMarkup). */
export function tripSheetHtml(trip: SavedTrip, weekLabel: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const name = (i: number) => (i === 0 ? trip.home.name : `${trip.stops[i - 1]!.jobNo} ${trip.stops[i - 1]!.name}`);
  const p = trip.plan;
  const days = p.days
    .map((d, di) => {
      let t = trip.startHour;
      const from = di === 0 || p.days[di - 1]!.endsAt === "home" ? trip.home.name : name(p.days[di - 1]!.endsAt as number);
      const rows = d.events
        .map((e) => {
          const at = t;
          t += e.hours;
          if (trivial(e)) return "";
          if (e.type === "drive") {
            return `<tr class="ts-drive"><td></td><td colspan="3">Drive ${esc(duration(e.hours))} · ${Math.round(e.miles)} mi → ${esc(e.to === 0 ? trip.home.name : trip.stops[e.to - 1]!.jobNo)}</td></tr>`;
          }
          const s = trip.stops[e.stop - 1]!;
          return `<tr><td>${clock(at)}</td><td>${stopNo(p.order, e.stop)}. <b>${esc(s.jobNo)}</b> ${esc(s.name)}${e.parts > 1 ? ` (part ${e.part} of ${e.parts})` : ""}</td><td>${esc(s.address)}</td><td>${hrs(e.hours)} h</td></tr>`;
        })
        .join("");
      const end = d.endsAt === "home" ? `Back at ${trip.home.name}` : `Night near ${name(d.endsAt)}`;
      return `<h3 class="ts-day">Day ${d.day} — ${esc(duration(d.driveHours))} driving · ${hrs(d.workHours)} h work</h3>
<table class="ts-table"><thead><tr><th>Time</th><th>Job</th><th>Address</th><th>Hours</th></tr></thead><tbody>
<tr><td>${clock(trip.startHour)}</td><td colspan="3">Leave ${esc(from)}</td></tr>${rows}
<tr><td>${clock(t)}</td><td colspan="3"><b>${esc(end)}</b></td></tr></tbody></table>`;
    })
    .join("");
  const warn = p.warnings.map((w) => `<p class="ts-warn">⚠ ${esc(w)}</p>`).join("");
  return `<div class="ts">
<div class="print-doc__title">${esc(trip.name)}</div>
<p class="ts-meta">Week of ${esc(weekLabel)} · leaves ${esc(trip.home.name)} (${esc(trip.home.address)}) ·
${p.days.length} day${p.days.length === 1 ? "" : "s"}${p.nights ? `, ${p.nights} night${p.nights === 1 ? "" : "s"}` : ""} ·
${esc(duration(p.driveHours))} driving (${Math.round(p.miles)} mi) · ${hrs(p.workHours)} h on site ·
${trip.source === "road" ? "road drive times" : "estimated drive times"}</p>${warn}${days}
<p class="ts-foot">Saved by ${esc(trip.savedBy || "—")} · Lumineo Switchboard Install Planner</p></div>`;
}
