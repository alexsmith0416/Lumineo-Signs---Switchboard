import {
  INSTALL_CREWS,
  INSTALL_DEPARTMENTS,
  INSTALL_LINES,
  INSTALL_OVERTIME,
  INSTALL_WORK_HOURS,
} from "../data/mock-installation";
import { createMockDataSource } from "./data-source";

// STUB: replace with real Dataverse `crfdf_installationscheduleline` reads
// once M6 wiring lands. LNI Project Scheduler shares this table — both apps
// will read/write the same rows.
export const installationDataSource = createMockDataSource("installation", {
  departments: INSTALL_DEPARTMENTS,
  employees: INSTALL_CREWS,
  schedule: INSTALL_LINES,
  workHours: INSTALL_WORK_HOURS,
  overtime: INSTALL_OVERTIME,
});
