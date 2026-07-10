export type DepartmentId = string;
export type EmployeeId = string;
export type ScheduleLineId = string;

export interface Department {
  id: DepartmentId;
  name: string;
  flowOrder: number;
  color: string;
}

export interface Employee {
  id: EmployeeId;
  name: string;
  departmentId: DepartmentId;
  productivityRate: number;
  standardHoursPerDay: number;
  maxOvertimePerDay: number;
  worksWeekends: boolean;
  hourlyRate?: number;

  // Installation-roster fields (from crfdf_InstallationEmployees). Production
  // employees leave these undefined. `position` is the explicit ordering within
  // a location group; `truckNumber` shows beneath the name (replacing the
  // production %/hours subtext); `isCertifiedCraneOperator` renders the CCO badge.
  truckNumber?: string | null;
  isCertifiedCraneOperator?: boolean;
  position?: number;
}

export interface ScheduleLine {
  id: ScheduleLineId;
  jobNo: string;
  customerName: string;
  planningLineDescription: string;
  /** BC job header description (crfdf_description) — rendered under the job name
   *  on the card, above the task text. Custom / shipment cards leave it unset. */
  jobDescription?: string;
  startDateTime: Date;
  endDateTime: Date;
  estimatedHours: number;
  overrideHours: number | null;
  employeeId: EmployeeId;
  departmentId: DepartmentId;
  customerDueDate: Date | null;
  isLocked: boolean;
  jobSequence: number;

  // Optional billing + install-specific metadata. Production lines typically
  // leave these null; install lines populate them so the UI can render the
  // weather chip, crew badge, and dollar amount.
  invoiceAmount?: number | null;
  crewPersons?: number | null;
  crewTrucks?: number | null;
  crewCranes?: number | null;
  crewLifts?: number | null;
  crewBuckets?: number | null;
  installZip?: string | null;
  region?: string | null;

  // Optional: marks a non-BC card used to block out time (PTO, Holiday,
  // Maintenance, etc.). When `isCustom` is true the card uses
  // `customColor`/`customTextColor` for its background/text instead of
  // the department palette, and renders a simplified layout.
  isCustom?: boolean;
  customColor?: string | null;
  customTextColor?: string | null;

  // When set, this custom card represents a Shipping load placed on the install
  // schedule (links back to the load in the shipping store).
  shipmentLoadId?: string | null;

  // The user's last-explicit position for this line. Cascade uses this as
  // the floor: a pushed task pulls back to its preferred position when
  // the cause moves back. Defaults to `startDateTime` on load. Set to
  // the new start whenever the user explicitly drags / edits the task.
  preferredStart?: Date | null;
}

export interface WorkHoursOverride {
  employeeId: EmployeeId;
  date: string;
  hours: number;
}

export interface OvertimeOverride {
  employeeId: EmployeeId;
  date: string;
  extraHours: number;
  costMultiplier: number;
}

export interface ScheduleContext {
  employees: Map<EmployeeId, Employee>;
  departments: Map<DepartmentId, Department>;
  schedule: ScheduleLine[];
  workHours: WorkHoursOverride[];
  overtime: OvertimeOverride[];
}

export type ConflictType =
  | "past-due"
  | "department-order"
  | "employee-overlap"
  | "capacity-exceeded";

export interface Conflict {
  type: ConflictType;
  lineId: ScheduleLineId;
  relatedLineId?: ScheduleLineId;
  message: string;
}

export type ScenarioChange =
  | { type: "shift-task"; lineId: ScheduleLineId; newStart: Date; newEmployeeId?: EmployeeId }
  | { type: "update-duration"; lineId: ScheduleLineId; overrideHours: number }
  | { type: "add-overtime"; employeeId: EmployeeId; date: string; extraHours: number; costMultiplier?: number }
  | { type: "enable-weekends"; employeeId: EmployeeId }
  | {
      type: "insert-rush-job";
      jobNo: string;
      customerName: string;
      customerDueDate: Date;
      earliestStart: Date;
      tasks: Array<{
        planningLineDescription: string;
        estimatedHours: number;
        departmentId: DepartmentId;
        employeeId: EmployeeId;
      }>;
    };

export interface ShiftResult {
  context: ScheduleContext;
  moved: ScheduleLineId[];
  conflicts: Conflict[];
}

export interface ScenarioResult {
  base: ScheduleContext;
  scenario: ScheduleContext;
  changes: ScenarioChange[];
  movedLineIds: Set<ScheduleLineId>;
  newLineIds: Set<ScheduleLineId>;
  conflicts: Conflict[];
}

export interface CommitPatch {
  lineId: ScheduleLineId;
  changes: Partial<ScheduleLine>;
  isInsert: boolean;
}

export interface CommitResult {
  patches: CommitPatch[];
}
