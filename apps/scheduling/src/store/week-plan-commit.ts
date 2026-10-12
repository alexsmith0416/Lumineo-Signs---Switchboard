import { addDays, addMinutes, format } from "date-fns";
import type { ScheduleLine } from "../engine/types";
import { useInstallationStoreNEK, useInstallationStoreWK } from "./schedule-store";
import { useJobScheduleStore } from "./job-schedule-store";
import { useTripStore } from "./trip-store";
import { cardsFor, type Assignment } from "../services/week-plan";
import { defaultTripName, type SavedTrip } from "../services/saved-trips";
import type { WeekCrews } from "../services/week-plan-data";

/**
 * Install Planner Stage 3 — put a reviewed week plan on the install boards
 * (Oct 11, 2026). For each trip given to a crew:
 *  - one install card per job per day it's worked, on that crew's lane, at the
 *    time the trip reaches it, pinned to its day (spanDays 1 — a trip day is
 *    up to 10 h with driving, longer than the board's 8–4 window);
 *  - the job's Scheduled install date = its first day;
 *  - the trip saved for the installers' Install Trips screen.
 * Cards go through the board store (addScheduleLine), so a failed save stays
 * on screen and is reported, like any card added by hand.
 */
export async function commitWeekPlan(input: {
  assignments: readonly Assignment[];
  weekStart: Date;
  startHour: number;
  maxNights: number;
  crews: WeekCrews;
  userName: string;
}): Promise<{ cards: number; trips: number }> {
  const firstDay = new Map<string, Date>();
  let cards = 0;
  for (const a of input.assignments) {
    const region = input.crews.regionOf.get(a.crewId) ?? "WK";
    const store = region === "NEK" ? useInstallationStoreNEK : useInstallationStoreWK;
    const departmentId = input.crews.deptOf.get(a.crewId) ?? "";
    for (const c of cardsFor(a, input.startHour)) {
      const day = addDays(input.weekStart, c.day);
      const start = addMinutes(day, Math.round(c.start * 60));
      const end = addMinutes(start, Math.round(c.hours * 60));
      const line: ScheduleLine = {
        id: crypto.randomUUID(),
        jobNo: c.jobNo,
        customerName: c.name,
        jobDescription: undefined,
        planningLineDescription:
          `${c.kind === "service" ? "Service" : "Install"}${c.parts > 1 ? ` · day ${c.part} of ${c.parts}` : ""} · planned trip`,
        startDateTime: start,
        endDateTime: end,
        estimatedHours: Math.round(c.hours * 100) / 100,
        overrideHours: null,
        spanDays: 1,
        employeeId: a.crewId,
        departmentId,
        customerDueDate: null,
        isLocked: false,
        jobSequence: 0,
        preferredStart: start,
        crewPersons: null,
        crewTrucks: null,
        crewTrips: null,
        installZip: c.zip || null,
        invoiceAmount: null,
      };
      await store.getState().addScheduleLine(line);
      cards++;
      const prev = firstDay.get(c.jobNo);
      if (!prev || day < prev) firstDay.set(c.jobNo, day);
    }
  }

  // Scheduled install = the first day it's worked (Jobs list + boards).
  const schedules = useJobScheduleStore.getState();
  await schedules.load();
  for (const [jobNo, day] of firstDay) await schedules.update(jobNo, { scheduledInstallDate: day });

  // The trips, for the installers.
  const savedAt = new Date().toISOString();
  for (const a of input.assignments) {
    const trip: SavedTrip = {
      id: crypto.randomUUID(),
      name: `${a.crewName} · ${defaultTripName(a.trip.home.region, a.trip.home.name, a.trip.stops)}`,
      region: a.trip.home.region,
      weekStart: format(input.weekStart, "yyyy-MM-dd"),
      home: { name: a.trip.home.name, address: a.trip.home.address, lat: a.trip.home.lat, lng: a.trip.home.lng },
      stops: a.trip.stops,
      plan: a.trip.plan,
      startHour: input.startHour,
      maxNights: input.maxNights,
      source: "estimate",
      line: [],
      savedBy: input.userName,
      savedAt,
    };
    await useTripStore.getState().save(trip);
  }
  return { cards, trips: input.assignments.length };
}
