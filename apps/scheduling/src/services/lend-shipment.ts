/**
 * Putting a shipment load on a PRODUCTION employee.
 *
 * Most of the company reads the Installation board to see what's going out, but
 * a production employee reads Production to see their own week. So a load run by
 * a production person has to exist on both: it is created as a real install card
 * (that's the board everyone checks), and the person is lent to Installation for
 * that day so the card has a row to live on — which in turn makes it mirror back
 * onto their production row automatically.
 *
 * One-way by design: an INSTALL employee scheduled for a load stays on the
 * install board only. Nothing here runs for them.
 *
 * Region is always WK. Loads are picked up from the shop, so that's where these
 * runs belong; a NEK run can be moved by hand on the install board afterwards.
 */

import { format, startOfWeek } from "date-fns";
import type { Employee, ScheduleLine } from "../engine/types";
import { useInstallationStoreWK } from "../store/schedule-store";
import { useAssistStore } from "../store/assist-store";
import { weekdayIndex } from "./assist-mirror";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** Monday of the week a date falls in, as the yyyy-mm-dd key assist rows use. */
export function assistWeekKey(d: Date): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/**
 * Ensure `employee` is lent to WK Installation on `start`'s day, and return the
 * install-roster row id to hang the card on.
 *
 * Reuses their existing row for that week when there is one — otherwise placing
 * a second load on the same person would give them two rows on the install
 * roster for the same week.
 */
async function ensureLentForDay(employee: Employee, start: Date): Promise<string | null> {
  const weekStart = assistWeekKey(start);
  const dayIndex = weekdayIndex(start);

  if (!LIVE) {
    const { upsertMockAssistDay } = await import("../data/mock-assist");
    const id = upsertMockAssistDay({
      sourceEmpId: employee.id,
      name: employee.name,
      weekStart,
      dayIndex,
    });
    await useAssistStore.getState().refresh();
    return id;
  }

  const dv = await import("./dataverse-live");
  const existing = useAssistStore
    .getState()
    .rows.find((r) => r.sourceEmpId === employee.id && r.weekStart === weekStart && !r.regionIsNek);

  if (existing) {
    const days = existing.days.length ? [...existing.days] : [0, 1, 2, 3, 4];
    if (!days.includes(dayIndex)) days.push(dayIndex);
    // A shipment run takes the whole day, so drop any AM/PM on it.
    const halves = { ...existing.halves };
    delete halves[dayIndex];
    await dv.updateAssistRow(existing.id, { days, halves });
    await useAssistStore.getState().refresh();
    return existing.id;
  }

  await dv.createAssistRow({
    sourceEmpId: employee.id,
    name: employee.name,
    regionIsNek: false,
    weekStart,
    days: [dayIndex],
  });
  // createAssistRow doesn't hand back the new id, so re-read and find it.
  await useAssistStore.getState().refresh();
  const created = useAssistStore
    .getState()
    .rows.find((r) => r.sourceEmpId === employee.id && r.weekStart === weekStart && !r.regionIsNek);
  return created?.id ?? null;
}

export interface PlaceShipmentInput {
  employee: Employee;
  /** The custom card as built by the Add panel (title, colors, load id, dates). */
  line: ScheduleLine;
}

/**
 * Create the install card and lend the employee for its day.
 *
 * Throws if the employee couldn't be lent — the caller surfaces that rather than
 * silently writing a card onto a row that doesn't exist.
 */
export async function placeShipmentOnProductionEmployee({
  employee,
  line,
}: PlaceShipmentInput): Promise<void> {
  const installEmpId = await ensureLentForDay(employee, line.startDateTime);
  if (!installEmpId) {
    throw new Error(
      `Couldn't add ${employee.name} to the Installation schedule, so the load wasn't placed.`,
    );
  }

  const wk = useInstallationStoreWK.getState();
  // The card belongs to the install roster row, and to that row's location
  // group — its production department id means nothing on the install board.
  const installDeptId = wk.employees.get(installEmpId)?.departmentId ?? "0";

  await wk.addScheduleLine({
    ...line,
    id: `ship-${employee.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId: installEmpId,
    departmentId: installDeptId,
  });

  // Re-read the week so the newly lent row appears on the install roster.
  await wk.loadWeek();
}
