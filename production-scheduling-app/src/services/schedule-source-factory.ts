// Factory that builds a live ScheduleDataSource over one of the three
// schedule-line Dataverse tables. Production / Installation (WK + NEK) /
// Shipping all share the shape — the only differences are the table name,
// the kind tag, and an optional fixed region filter.

import type { ScheduleLine } from "../engine/types";
import type { ScheduleDataSource, ScheduleKind } from "./data-source";
import { getDataverseReader } from "./dataverse-reader";
import {
  rowToDepartment,
  rowToEmployee,
  rowToOvertime,
  rowToScheduleLine,
  rowToWorkHours,
  scheduleLineToRow,
} from "./schedule-line-mapping";

const T_EMPLOYEE = "crfdf_employee1";
const T_DEPARTMENT = "crfdf_department1";
const T_WORK_HOURS = "crfdf_employeeworkhours";
const T_OVERTIME = "crfdf_overtimeoverride";

export interface LiveSourceConfig {
  kind: ScheduleKind;
  /** Schedule-line table logical name */
  table: string;
  /** Optional region filter, e.g. "WK" | "NEK" — appended to every read */
  region?: string;
}

export function createLiveScheduleSource(config: LiveSourceConfig): ScheduleDataSource {
  const { kind, table, region } = config;
  const regionClause = region ? ` and crfdf_region eq '${region}'` : "";

  return {
    kind,

    async loadDepartments() {
      const rows = await getDataverseReader().retrieveMultiple(T_DEPARTMENT, {
        filter: `statecode eq 0`,
        orderBy: "crfdf_floworder asc",
      });
      return rows.map(rowToDepartment);
    },

    async loadEmployees() {
      const rows = await getDataverseReader().retrieveMultiple(T_EMPLOYEE, {
        filter: `statecode eq 0`,
        orderBy: "crfdf_employeename asc",
      });
      return rows.map(rowToEmployee);
    },

    async loadScheduleLines(from: Date, to: Date) {
      const rows = await getDataverseReader().retrieveMultiple(table, {
        // Overlap query: line intersects [from, to] when it starts before
        // the window ends AND ends after the window starts — catches
        // multi-day cards that straddle the window edges.
        filter:
          `crfdf_startdatetime le ${to.toISOString()} and ` +
          `crfdf_enddatetime ge ${from.toISOString()}` +
          regionClause,
        orderBy: "crfdf_startdatetime asc",
      });
      return rows.map(rowToScheduleLine);
    },

    async loadWorkHours(from: Date, to: Date) {
      const rows = await getDataverseReader().retrieveMultiple(T_WORK_HOURS, {
        filter:
          `crfdf_date ge ${from.toISOString().slice(0, 10)} and ` +
          `crfdf_date le ${to.toISOString().slice(0, 10)}`,
      });
      return rows.map(rowToWorkHours);
    },

    async loadOvertimeOverrides(from: Date, to: Date) {
      const rows = await getDataverseReader().retrieveMultiple(T_OVERTIME, {
        filter:
          `crfdf_date ge ${from.toISOString().slice(0, 10)} and ` +
          `crfdf_date le ${to.toISOString().slice(0, 10)}`,
      });
      return rows.map(rowToOvertime);
    },

    async updateScheduleLine(id: string, changes: Partial<ScheduleLine>) {
      const row = await getDataverseReader().update(table, id, scheduleLineToRow(changes));
      return rowToScheduleLine(row);
    },

    async createScheduleLine(line: ScheduleLine) {
      const payload = scheduleLineToRow(line);
      if (region && !payload.crfdf_region) payload.crfdf_region = region;
      const row = await getDataverseReader().create(table, payload);
      const created = rowToScheduleLine(row);
      // Some SDK create() responses return only the id — backfill from the
      // input so the store doesn't render an empty card.
      return created.jobNo ? created : { ...line, id: created.id || line.id };
    },

    async deleteScheduleLine(id: string) {
      await getDataverseReader().remove(table, id);
    },
  };
}
