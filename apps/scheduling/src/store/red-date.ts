// Red Date automation (Oct 17, 2026). A red date reaches the job's dates
// store from the Jobs list Red Date column, the card's Install Dates or the
// job panel — job-schedule-store.update calls onRedDateChanged for all of them:
//  - Priority follows: a red date sets Priority to RED DATE; clearing the red
//    date clears a RED DATE priority. (Choosing RED DATE in Priority on a job
//    that already has a red date places its card, onRedPriority.)
//  - A job with no install card gets one, ENDING on the red date, locked, on
//    the top crew member of the location nearest the ship-to, within the job's
//    Install Region (services/red-date.ts). An install card already past the
//    new red date is flagged instead of moved.
// The boards refuse any later move past the red date (schedule-store.ts).

import type { ScheduleLine } from "../engine/types";
import { useJobScheduleStore } from "./job-schedule-store";
import { ensureJobsLoaded, useJobTrackingStore } from "./job-tracking-store";
import { useJobGeoStore } from "./job-geo-store";
import { useInstallationStoreNEK, useInstallationStoreWK } from "./schedule-store";
import { useInstallCardsStore } from "../services/install-cards";
import { showNotice } from "./notice-store";
import { loadZipCentroids, nearestLocation, zipCenter, type LatLng, type Region } from "../services/geo";
import { isInstallResource } from "../services/planning-line-mapping";
import {
  INSTALL_DAY_HOURS,
  RED_PRIORITY,
  pastRedDate,
  pickRedDateCrew,
  redDateLabel,
  redDateRegion,
  redDateWindow,
} from "../services/red-date";

const sameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a ? a.toDateString() : "") === (b ? b.toDateString() : "");

/** A job's red date changed (set, moved or cleared). Never throws. */
export async function onRedDateChanged(jobNo: string, red: Date | null, prev: Date | null): Promise<void> {
  if (!jobNo || sameDay(red, prev)) return;
  try {
    await ensureJobsLoaded();
    const track = useJobTrackingStore.getState().tracks.find((t) => t.jobNo === jobNo);
    const priority = (track?.priority ?? "").trim();
    if (red && priority !== RED_PRIORITY) {
      await useJobTrackingStore.getState().updateTrack(jobNo, { priority: RED_PRIORITY });
    } else if (!red && priority === RED_PRIORITY) {
      await useJobTrackingStore.getState().updateTrack(jobNo, { priority: "" });
    }
    if (red) await placeRedDateCard(jobNo, red);
  } catch (e) {
    console.warn("[red-date] automation failed", e);
  }
}

/** Priority was set to RED DATE: place the card if the job already has a red date. */
export async function onRedPriority(jobNo: string): Promise<void> {
  const red = useJobScheduleStore.getState().byJob[jobNo]?.redDate ?? null;
  if (!red) return;
  try {
    await placeRedDateCard(jobNo, red);
  } catch (e) {
    console.warn("[red-date] placement failed", e);
  }
}

// One placement per job at a time: setting a red date also sets Priority, whose
// hook (onRedPriority) would otherwise race this one into a second card. Once
// a placement finishes, the card is in the install-card cache, so a later call
// sees it and stops.
const placing = new Set<string>();

async function placeRedDateCard(jobNo: string, red: Date): Promise<void> {
  if (placing.has(jobNo)) return;
  placing.add(jobNo);
  try {
    await placeOnce(jobNo, red);
  } finally {
    placing.delete(jobNo);
  }
}

async function placeOnce(jobNo: string, red: Date): Promise<void> {
  // Already on an install board? Leave it there — just flag it if it's late.
  const cache = useInstallCardsStore.getState();
  const existing = [...cache.wk, ...cache.nek].filter((c) => c.jobNo === jobNo && !c.isCustom && !c.shipmentLoadId);
  if (existing.length) {
    if (existing.some((c) => pastRedDate(c.endDateTime, red))) {
      showNotice({
        title: "Install is after the Red Date",
        message: `Job ${jobNo} already has an install card after its Red Date (${redDateLabel(red)}). Move it to that day or earlier.`,
      });
    }
    return;
  }

  const track = useJobTrackingStore.getState().tracks.find((t) => t.jobNo === jobNo);
  const wanted = redDateRegion(track?.installRegion);
  if (wanted === "skip") return; // sub-installer / house — no crew of ours

  const dv = await import("../services/dataverse-live");
  const job = await dv.getBcJobLive(jobNo).catch(() => null);
  const shipTo = await shipToPosition(jobNo, job?.shipToZip ?? "");
  const region: Region | null = wanted ?? (shipTo ? nearestLocation(shipTo).region : null);
  if (!region) {
    showNotice({
      title: "Red Date set — no install card added",
      message: `Couldn't tell which region installs job ${jobNo} (no Install Region on the Jobs list and no ship-to ZIP). Set its Install Region, or add the install card by hand.`,
    });
    return;
  }

  const store = region === "NEK" ? useInstallationStoreNEK : useInstallationStoreWK;
  const loaded = [...store.getState().employees.values()];
  const employees = loaded.length ? loaded : await store.getState().dataSource.loadEmployees();
  const pick = pickRedDateCrew(shipTo, region, employees);
  if (!pick) {
    showNotice({
      title: "Red Date set — no install card added",
      message: `No ${region} install crew to put job ${jobNo} on. Add the install card by hand.`,
    });
    return;
  }

  const install = (job?.planningLines ?? []).filter((l) => isInstallResource(l.resourceNo));
  const hours = install.reduce((sum, l) => sum + (l.estimatedHours || 0), 0) || INSTALL_DAY_HOURS;
  const win = redDateWindow(red, hours);
  const line: ScheduleLine = {
    id: crypto.randomUUID(),
    jobNo,
    customerName: job?.customerName || jobNo,
    jobDescription: job?.description || undefined,
    planningLineDescription: install.map((l) => l.description).filter(Boolean).join("\n") || "Install · Red Date",
    startDateTime: win.start,
    endDateTime: win.end,
    estimatedHours: Math.round(hours * 100) / 100,
    overrideHours: null,
    employeeId: pick.employee.id,
    departmentId: pick.employee.departmentId,
    customerDueDate: null,
    // Locked: a fixed drop-dead date — cascades flow around it.
    isLocked: true,
    jobSequence: 0,
    preferredStart: win.start,
    crewPersons: null,
    crewTrucks: null,
    crewTrips: null,
    installZip: job?.shipToZip || null,
    invoiceAmount: null,
  };
  await store.getState().addScheduleLine(line);
  showNotice({
    title: "Red Date scheduled",
    message: `Job ${jobNo} was put on ${pick.employee.name}'s row (${pick.location.name}, ${region}) ending ${redDateLabel(red)}, locked. Drag it to another crew or an earlier day if needed.`,
  });
}

/** The ship-to's position: its looked-up address when known, else its ZIP's center. */
async function shipToPosition(jobNo: string, zip: string): Promise<LatLng | null> {
  const geo = useJobGeoStore.getState().geos.get(jobNo);
  if (geo && geo.lat != null && geo.lng != null) return { lat: geo.lat, lng: geo.lng };
  if (!zip) return null;
  return zipCenter(await loadZipCentroids(), zip);
}
