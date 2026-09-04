// Dev-only fixtures for "assist installation" — a production employee lent to
// an install crew for a week.
//
// This whole mechanism is Dataverse-backed (assist rows are installation
// employee rows with crfdf_assistsourceemp set, and install cards live in
// crfdf_installcard), so before this file existed none of it could be seen or
// tested in dev: the assist store returned [] and the install-card cache stayed
// empty. That meant the cross-board behaviour was only ever provable on the
// deployed app — the same trap that hid the multi-week-job bug.
//
// Dates are built relative to the CURRENT week so the fixtures are always on
// screen when you open the board.

import { addDays, format, startOfWeek } from "date-fns";
import type { Employee, ScheduleLine } from "../engine/types";
import type { AssistAssignment } from "../services/dataverse-live";

const mondayOf = (d: Date): Date => startOfWeek(d, { weekStartsOn: 1 });

/** The install-roster row a lent production employee appears as. */
export const MOCK_ASSIST_EMPLOYEE: Employee = {
  id: "wk-assist-chris",
  name: "Chris Owen",
  departmentId: "loc-hutch",
  productivityRate: 1,
  standardHoursPerDay: 8,
  maxOvertimePerDay: 0,
  worksWeekends: false,
  isAssist: true,
  position: 9999,
};

/** Production employee this row lends. Matches MOCK_EMPLOYEES in mock-schedule. */
const SOURCE_EMP_ID = "emp-chris";

// Mutable so the dev board can lend someone at runtime (see upsertMockAssistDay).
let rows: AssistAssignment[] | null = null;

/**
 * Chris is lent to WK this week: Tuesday all day, Wednesday mornings only.
 * Thursday is deliberately NOT lent, so the "only the lent days block" and
 * "AM/PM leaves the other half open" behaviours are both visible.
 *
 * Returns copies — callers must go through upsertMockAssistDay to change them.
 */
export function mockAssistRows(today = new Date()): AssistAssignment[] {
  if (!rows) {
    rows = [
      {
        id: MOCK_ASSIST_EMPLOYEE.id,
        name: MOCK_ASSIST_EMPLOYEE.name,
        regionIsNek: false,
        sourceEmpId: SOURCE_EMP_ID,
        weekStart: format(mondayOf(today), "yyyy-MM-dd"),
        days: [1, 2],
        halves: { 2: "am" },
      },
    ];
  }
  return rows.map((r) => ({ ...r, days: [...r.days], halves: { ...r.halves } }));
}

/**
 * Dev stand-in for createAssistRow/updateAssistRow: lend `sourceEmpId` for one
 * more day, reusing their existing row for that week if there is one (which is
 * what the live path does, so placing a second load on someone doesn't give
 * them two rows on the install roster).
 *
 * Returns the install-roster row id the caller should hang the card on.
 */
export function upsertMockAssistDay(input: {
  sourceEmpId: string;
  name: string;
  weekStart: string;
  dayIndex: number;
}): string {
  mockAssistRows(); // ensure seeded
  const existing = rows!.find(
    (r) => r.sourceEmpId === input.sourceEmpId && r.weekStart === input.weekStart,
  );
  if (existing) {
    if (!existing.days.includes(input.dayIndex)) existing.days.push(input.dayIndex);
    // A day used for a shipment is a whole day, so clear any half on it.
    delete existing.halves[input.dayIndex];
    return existing.id;
  }
  const id = `wk-assist-${input.sourceEmpId}-${input.weekStart}`;
  rows!.push({
    id,
    name: input.name,
    regionIsNek: false,
    sourceEmpId: input.sourceEmpId,
    weekStart: input.weekStart,
    days: [input.dayIndex],
    halves: {},
  });
  return id;
}

/** Install-roster rows for the dev board, including any created at runtime. */
export function mockAssistEmployees(): Employee[] {
  return mockAssistRows().map((r) => ({
    ...MOCK_ASSIST_EMPLOYEE,
    id: r.id,
    name: r.name,
  }));
}

/** Install cards sitting on that assist row — what gets mirrored onto Production. */
export function mockAssistCards(today = new Date()): ScheduleLine[] {
  const mon = mondayOf(today);
  const at = (dayIndex: number, hour: number): Date => {
    const d = addDays(mon, dayIndex);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const base = {
    overrideHours: null,
    employeeId: MOCK_ASSIST_EMPLOYEE.id,
    departmentId: MOCK_ASSIST_EMPLOYEE.departmentId,
    customerDueDate: null,
    isLocked: false,
    jobSequence: 0,
  };
  return [
    {
      ...base,
      id: "assist-card-1",
      jobNo: "J36532",
      customerName: "Ballard Center",
      planningLineDescription: "Set wall pan w/ FCOs",
      startDateTime: at(1, 8),
      endDateTime: at(1, 16),
      estimatedHours: 8,
      installZip: "66044",
    },
    {
      ...base,
      id: "assist-card-2",
      jobNo: "J25219",
      customerName: "Central National Bank",
      planningLineDescription: "Hang wall sign",
      startDateTime: at(2, 8),
      endDateTime: at(2, 12),
      estimatedHours: 4,
      installZip: "66061",
    },
  ] as ScheduleLine[];
}
