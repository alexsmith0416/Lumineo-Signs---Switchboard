// Shared row ⇄ engine mapping for the three schedule-line Dataverse tables
// (crfdf_productionscheduleline / crfdf_installationscheduleline /
// crfdf_shippingscheduleline). All three share one column layout, so the
// three data sources share this mapper.

import type {
  Department,
  Employee,
  OvertimeOverride,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";
import {
  bool,
  dateOrNull,
  num,
  str,
  type DataverseRow,
} from "./dataverse-reader";

export function rowToScheduleLine(row: DataverseRow): ScheduleLine {
  const start =
    dateOrNull(row, "crfdf_startdatetime", "startDateTime") ?? new Date();
  const end = dateOrNull(row, "crfdf_enddatetime", "endDateTime") ?? start;
  return {
    id: str(row, "crfdf_productionschedulelineid", "crfdf_installationschedulelineid", "crfdf_shippingschedulelineid", "id"),
    jobNo: str(row, "crfdf_jobno", "jobNo"),
    customerName: str(row, "crfdf_customername", "customerName"),
    planningLineDescription: str(row, "crfdf_planninglinedescription", "planningLineDescription"),
    startDateTime: start,
    endDateTime: end,
    estimatedHours: num(row, "crfdf_estimatedhours", "estimatedHours"),
    overrideHours: (() => {
      const v = num(row, "crfdf_overridehours", "overrideHours");
      return v > 0 ? v : null;
    })(),
    employeeId: str(row, "_crfdf_employee_value", "crfdf_employeeid", "employeeId"),
    departmentId: str(row, "_crfdf_department_value", "crfdf_departmentid", "departmentId"),
    customerDueDate: dateOrNull(row, "crfdf_customerduedate", "customerDueDate"),
    isLocked: bool(row, "crfdf_islocked", "isLocked"),
    jobSequence: num(row, "crfdf_jobsequence", "jobSequence"),
    invoiceAmount: num(row, "crfdf_invoiceamount", "invoiceAmount") || null,
    crewPersons: num(row, "crfdf_crewpersons", "crewPersons") || null,
    crewTrucks: num(row, "crfdf_crewtrucks", "crewTrucks") || null,
    installZip: str(row, "crfdf_installzip", "installZip") || null,
    region: str(row, "crfdf_region", "region") || null,
    isCustom: bool(row, "crfdf_iscustom", "isCustom") || undefined,
    customColor: str(row, "crfdf_customcolor", "customColor") || null,
    customTextColor: str(row, "crfdf_customtextcolor", "customTextColor") || null,
  };
}

export function scheduleLineToRow(
  line: Partial<ScheduleLine>,
): DataverseRow {
  const row: DataverseRow = {};
  if (line.jobNo !== undefined) row.crfdf_jobno = line.jobNo;
  if (line.customerName !== undefined) row.crfdf_customername = line.customerName;
  if (line.planningLineDescription !== undefined)
    row.crfdf_planninglinedescription = line.planningLineDescription;
  if (line.startDateTime !== undefined)
    row.crfdf_startdatetime = line.startDateTime.toISOString();
  if (line.endDateTime !== undefined)
    row.crfdf_enddatetime = line.endDateTime.toISOString();
  if (line.estimatedHours !== undefined) row.crfdf_estimatedhours = line.estimatedHours;
  if (line.overrideHours !== undefined) row.crfdf_overridehours = line.overrideHours;
  if (line.employeeId !== undefined) row.crfdf_employeeid = line.employeeId;
  if (line.departmentId !== undefined) row.crfdf_departmentid = line.departmentId;
  if (line.customerDueDate !== undefined)
    row.crfdf_customerduedate = line.customerDueDate?.toISOString() ?? null;
  if (line.isLocked !== undefined) row.crfdf_islocked = line.isLocked;
  if (line.jobSequence !== undefined) row.crfdf_jobsequence = line.jobSequence;
  if (line.invoiceAmount !== undefined) row.crfdf_invoiceamount = line.invoiceAmount;
  if (line.crewPersons !== undefined) row.crfdf_crewpersons = line.crewPersons;
  if (line.crewTrucks !== undefined) row.crfdf_crewtrucks = line.crewTrucks;
  if (line.installZip !== undefined) row.crfdf_installzip = line.installZip;
  if (line.region !== undefined) row.crfdf_region = line.region;
  if (line.isCustom !== undefined) row.crfdf_iscustom = line.isCustom;
  if (line.customColor !== undefined) row.crfdf_customcolor = line.customColor;
  if (line.customTextColor !== undefined)
    row.crfdf_customtextcolor = line.customTextColor;
  return row;
}

export function rowToEmployee(row: DataverseRow): Employee {
  return {
    id: str(row, "crfdf_employee1id", "crfdf_employeeid", "id"),
    name: str(row, "crfdf_employeename", "crfdf_name", "name"),
    departmentId: str(row, "_crfdf_department_value", "crfdf_departmentid", "departmentId"),
    productivityRate: num(row, "crfdf_productivityrate", "productivityRate") || 1,
    standardHoursPerDay: num(row, "crfdf_standardhoursperday", "standardHoursPerDay") || 8,
    maxOvertimePerDay: num(row, "crfdf_maxovertimeperday", "maxOvertimePerDay") || 0,
    worksWeekends: bool(row, "crfdf_worksweekends", "worksWeekends"),
    hourlyRate: num(row, "crfdf_hourlyrate", "hourlyRate") || undefined,
  };
}

export function rowToDepartment(row: DataverseRow): Department {
  return {
    id: str(row, "crfdf_department1id", "crfdf_departmentid", "id"),
    name: str(row, "crfdf_departmentname", "crfdf_name", "name"),
    flowOrder: num(row, "crfdf_floworder", "flowOrder") || 99,
    color: str(row, "crfdf_color", "color") || "#CCCCCC",
  };
}

export function rowToWorkHours(row: DataverseRow): WorkHoursOverride {
  return {
    employeeId: str(row, "_crfdf_employee_value", "crfdf_employeeid", "employeeId"),
    date: str(row, "crfdf_date", "date").slice(0, 10),
    hours: num(row, "crfdf_hours", "hours"),
  };
}

export function rowToOvertime(row: DataverseRow): OvertimeOverride {
  return {
    employeeId: str(row, "_crfdf_employee_value", "crfdf_employeeid", "employeeId"),
    date: str(row, "crfdf_date", "date").slice(0, 10),
    extraHours: num(row, "crfdf_extrahours", "extraHours"),
    costMultiplier: num(row, "crfdf_costmultiplier", "costMultiplier") || 1.5,
  };
}
