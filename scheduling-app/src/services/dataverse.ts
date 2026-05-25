import {
  MOCK_DEPARTMENTS,
  MOCK_EMPLOYEES,
  MOCK_OVERTIME,
  MOCK_SCHEDULE,
  MOCK_WORK_HOURS,
} from "../data/mock-schedule";
import { createMockDataSource } from "./data-source";

// STUB: replace with real Power SDK in M1 final.
// The interface in `./data-source.ts` is what the real implementation must
// satisfy. Once Power SDK is wired, export real implementations from
// `dataverse-production.ts`, `dataverse-installation.ts`, etc. and re-point
// the imports in `store/schedule-store.ts`.

export const productionDataSource = createMockDataSource("production", {
  departments: MOCK_DEPARTMENTS,
  employees: MOCK_EMPLOYEES,
  schedule: MOCK_SCHEDULE,
  workHours: MOCK_WORK_HOURS,
  overtime: MOCK_OVERTIME,
});

// Convenience alias preserved for code that historically imported a single
// dataverseService. New code should depend on the data source held by the
// relevant store (`useScheduleStore.getState().dataSource`).
export const dataverseService = productionDataSource;
