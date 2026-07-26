/**
 * Demo sandbox dataset. Tiles the existing mock fixtures across ~4 weeks so a
 * demo user has a full, busy board of Production / Installation / Shipping jobs
 * to play with. Everything here is IN-MEMORY only — edits mutate these closures
 * and never reach Dataverse or survive a reload, which is exactly what the demo
 * needs (a safe sandbox that "doesn't need saved").
 */
import { addDays } from "date-fns";
import type { ScheduleLine } from "../engine/types";
import { createMockDataSource, type ScheduleDataSource } from "../services/data-source";
import { MOCK_DEPARTMENTS, MOCK_EMPLOYEES, MOCK_SCHEDULE } from "../data/mock-schedule";
import {
  NEK_CREWS,
  NEK_DEPARTMENTS,
  NEK_LINES,
  WK_CREWS,
  WK_DEPARTMENTS,
  WK_LINES,
} from "../data/mock-installation";
import { SHIPPING_DEPARTMENTS, SHIPPING_LINES, SHIPPING_TRUCKS } from "../data/mock-shipping";

/** Clone a line shifted by `days`, with a unique id so tiled weeks don't collide. */
function shiftLine(line: ScheduleLine, days: number, suffix: string): ScheduleLine {
  return {
    ...line,
    id: `${line.id}${suffix}`,
    startDateTime: addDays(line.startDateTime, days),
    endDateTime: addDays(line.endDateTime, days),
    customerDueDate: line.customerDueDate ? addDays(line.customerDueDate, days) : null,
    preferredStart: line.preferredStart ? addDays(line.preferredStart, days) : line.preferredStart,
  };
}

/** Tile base lines across `offsets` (in days) to fill several weeks. Offset 0
 *  keeps the original ids so the first week looks like the familiar board. */
function tile(lines: ScheduleLine[], offsets: number[]): ScheduleLine[] {
  return offsets.flatMap((off, i) =>
    i === 0
      ? lines.map((l) => ({ ...l }))
      : lines.map((l) => shiftLine(l, off, `_w${i}`)),
  );
}

// Production base already spans ~2 weeks → tile +0/+14 for a 4-week board.
// Install / shipping bases span ~1 week → tile +0/+7/+14/+21.
const demoProductionLines = (): ScheduleLine[] => tile(MOCK_SCHEDULE, [0, 14]);
const demoWkLines = (): ScheduleLine[] => tile(WK_LINES, [0, 7, 14, 21]);
const demoNekLines = (): ScheduleLine[] => tile(NEK_LINES, [0, 7, 14, 21]);
const demoShippingLines = (): ScheduleLine[] => tile(SHIPPING_LINES, [0, 7, 14, 21]);

export interface DemoSources {
  production: ScheduleDataSource;
  wk: ScheduleDataSource;
  nek: ScheduleDataSource;
  shipping: ScheduleDataSource;
}

/**
 * A fresh, pristine set of in-memory demo sources. Called on every "enter demo"
 * so each launch starts clean. `delayMs: 0` keeps the sandbox snappy.
 */
export function makeDemoSources(): DemoSources {
  const empty = { workHours: [], overtime: [] };
  return {
    production: createMockDataSource(
      "production",
      { departments: MOCK_DEPARTMENTS, employees: MOCK_EMPLOYEES, schedule: demoProductionLines(), ...empty },
      0,
    ),
    wk: createMockDataSource(
      "installation",
      { departments: WK_DEPARTMENTS, employees: WK_CREWS, schedule: demoWkLines(), ...empty },
      0,
    ),
    nek: createMockDataSource(
      "installation",
      { departments: NEK_DEPARTMENTS, employees: NEK_CREWS, schedule: demoNekLines(), ...empty },
      0,
    ),
    shipping: createMockDataSource(
      "shipping",
      { departments: SHIPPING_DEPARTMENTS, employees: SHIPPING_TRUCKS, schedule: demoShippingLines(), ...empty },
      0,
    ),
  };
}
