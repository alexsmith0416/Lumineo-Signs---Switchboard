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
  /** BC resource number (crfdf_no) — who the person is in Business Central.
   *  Used to write `assignedTo` back to a BC planning step. Undefined until the
   *  roster row is mapped to a BC resource. */
  bcResourceNo?: string;

  // Installation-roster fields (from crfdf_InstallationEmployees). Production
  // employees leave these undefined. `position` is the explicit ordering within
  // a location group; `truckNumber` shows beneath the name (replacing the
  // production %/hours subtext); `isCertifiedCraneOperator` renders the CCO badge.
  truckNumber?: string | null;
  isCertifiedCraneOperator?: boolean;
  position?: number;
  /** True when this install-board row is a production employee temporarily lent
   *  to the install schedule (a temp "assist" crew row). */
  isAssist?: boolean;
  /** True for the synthetic "whole department" resource that owns a department's
   *  shared/team schedule lane. These never appear in the real roster (kept out
   *  of the store's employees map); they are merged into the engine context only
   *  so team lines cascade as one resource. See services/department-lane.ts. */
  isDepartmentLane?: boolean;
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
  /** Manual VISUAL span in calendar days (from dragging the card's right edge).
   *  Display-only — the engine ignores it (capacity/cascade use endDateTime), so
   *  stretching a card reserves no capacity. When set (>=1) it is AUTHORITATIVE:
   *  it can shrink the card below its hours-derived length as well as extend it.
   *  Undefined/null = span from hours. */
  spanDays?: number | null;
  /** Links the parts of a task scheduled in SECTIONS. Every part carries the
   *  same group id, the same (unchanged) `estimatedHours` pot, and its own slice
   *  of it in `overrideHours`. Unset on a normal, whole card. See
   *  services/split-hours.ts. Persisted as crfdf_splitgroup. */
  splitGroupId?: string | null;
  employeeId: EmployeeId;
  departmentId: DepartmentId;
  customerDueDate: Date | null;
  isLocked: boolean;
  jobSequence: number;

  /** True when this line is scheduled to a whole department rather than one
   *  person. It renders on the department's shared "team" lane (not on any
   *  individual row), rolls into every department member's My Schedule, and its
   *  `employeeId` is the synthetic department-lane id (see department-lane.ts).
   *  Persisted as crfdf_departmentwide; production lines default false. */
  departmentWide?: boolean;

  // Optional billing + install-specific metadata. Production lines typically
  // leave these null; install lines populate them so the UI can render the
  // weather chip, crew badge, and dollar amount.
  invoiceAmount?: number | null;
  /** Outstanding order value (crfdf_bcjobs.crfdf_remainingbalance), overlaid by
   *  job number at read time. Shown on the card under the $ toggle. */
  remainingValue?: number | null;
  crewPersons?: number | null;
  crewTrucks?: number | null;
  /** Number of install trips. crewPersons / crewTrucks are the crew PER trip. */
  crewTrips?: number | null;
  crewCranes?: number | null;
  crewLifts?: number | null;
  crewBuckets?: number | null;
  installZip?: string | null;
  region?: string | null;
  /** Installation only: this card is the job's FINAL install. Its day sets the
   *  job's scheduled install date (unless a Red date locks it). */
  finalInstall?: boolean;
  /** BC salesperson code for this job (crfdf_bcjobs.crfdf_salespersoncode),
   *  overlaid by job number at read time. Drives the card's PM line and the
   *  Sales/PM "Active Jobs" views. */
  salespersonCode?: string | null;
  /** Direct URL to the job's SharePoint folder (crfdf_bcjobs.crfdf_sharepointurl),
   *  overlaid by job number. Used by the card's "Open SharePoint Folder". */
  sharepointUrl?: string | null;

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

  // --- Mirroring (render-only; never persisted, never in an engine context) ---
  // A lent ("assist") production employee does their install work on the
  // Installation board, but needs to see it on their own Production row so one
  // board shows their whole week. Those cards are copied onto the production row
  // with `mirrorOf` set: they are read-only there, and are NOT part of the
  // production schedule the engine reasons about (the assist day already blocks
  // capacity, so counting them again would double-book the day).
  mirrorOf?: "installation";
  /** Which part of the day they're lent for — drives the Day/AM/PM badge. */
  mirrorHalf?: "full" | "am" | "pm";

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
