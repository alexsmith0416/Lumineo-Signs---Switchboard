import {
  NEK_CREWS,
  NEK_DEPARTMENTS,
  NEK_LINES,
  NEK_OVERTIME,
  NEK_WORK_HOURS,
  WK_CREWS,
  WK_DEPARTMENTS,
  WK_LINES,
  WK_OVERTIME,
  WK_WORK_HOURS,
} from "../data/mock-installation";
import { createMockDataSource } from "./data-source";

export const wkInstallDataSource = createMockDataSource("installation", {
  departments: WK_DEPARTMENTS,
  employees: WK_CREWS,
  schedule: WK_LINES,
  workHours: WK_WORK_HOURS,
  overtime: WK_OVERTIME,
});

export const nekInstallDataSource = createMockDataSource("installation", {
  departments: NEK_DEPARTMENTS,
  employees: NEK_CREWS,
  schedule: NEK_LINES,
  workHours: NEK_WORK_HOURS,
  overtime: NEK_OVERTIME,
});

// Default — most existing imports point here.
export const installationDataSource = wkInstallDataSource;
