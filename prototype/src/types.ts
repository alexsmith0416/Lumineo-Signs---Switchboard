export type Role =
  | "Operations"
  | "Sales"
  | "Production"
  | "Installation"
  | "Shipping";

export interface User {
  name: string;
  email: string;
  initials: string;
  role: Role;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  valueFormat: "currency" | "int" | "hours" | "percent" | "text";
  textValue?: string;
  goal?: string;
  delta?: number;
  deltaDirection?: "up" | "down" | "flat";
  deltaIsGood?: boolean;
  sparkline: number[];
}

export interface Announcement {
  id: string;
  body: string;
  audience: Role | "All";
}

export interface Birthday {
  name: string;
  whenLabel: string;
  initials: string;
}

export interface AppTile {
  key: string;
  label: string;
  emoji: string;
  audience: Role[];
  badgeText?: string;
  enabled: boolean;
  targetUrl: string;
}

export interface Photo {
  id: string;
  caption: string;
  jobNumber: string;
  by: string;
  gradient: string;
}

export interface SafetyMetric {
  currentStreakDays: number;
  longestStreakDays: number;
  lastResetDate: string;
}

/* ============ Role-specific home-screen widgets ============ */

export interface BarRow {
  label: string;
  value: number;
  valueLabel: string;
  color?: "navy" | "red" | "green" | "amber" | "violet";
}

export interface ListItem {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  badge?: { text: string; tone: "red" | "amber" | "green" | "navy" | "gray" };
  icon?: string;
}

export interface RouteStop {
  id: string;
  order: number;
  customer: string;
  address: string;
  cityState: string;
  windowLabel: string;
  jobNumber: string;
  crewLabel: string;
  status: "Next" | "Upcoming" | "Done";
}

export interface PhotoChecklistItem {
  id: string;
  label: string;
  required: boolean;
  taken: boolean;
}

export interface OpsWidgets {
  deptLoad: BarRow[];
  lateTasks: ListItem[];
  pendingApprovals: ListItem[];
}

export interface SalesWidgets {
  pipeline: BarRow[];
  hotOpps: ListItem[];
  recentCustomers: ListItem[];
  topCustomers: ListItem[];
}

export interface ProductionWidgets {
  todaysTasks: ListItem[];
  shopCalendar: ListItem[];
  needHelp: ListItem[];
}

export interface InstallationWidgets {
  route: RouteStop[];
  photoChecklist: PhotoChecklistItem[];
  materialsPull: ListItem[];
}

export interface ShippingWidgets {
  readyToShip: ListItem[];
  inTransit: ListItem[];
  receivingToday: ListItem[];
}

/* ============ Operations: upcoming target dates ============ */

export type TargetDept = "Production" | "Installation";
export type TargetStatus = "On track" | "At risk" | "Behind";

export interface UpcomingTarget {
  id: string;
  jobNumber: string;
  customer: string;
  scope: string;
  dept: TargetDept;
  targetDateISO: string;     // "2026-06-08"
  targetDateLabel: string;   // "Mon Jun 8"
  daysUntil: number;
  status: TargetStatus;
  partnerLabel?: string;
}

/* ============ Sales: active jobs in flight ============ */

export type JobDept =
  | "Sales"
  | "Estimating"
  | "Spec / Design"
  | "Production"
  | "Shipping"
  | "Installation"
  | "Invoicing";

export interface SalesActiveJob {
  id: string;
  jobNumber: string;
  customer: string;
  scope: string;
  currentDept: JobDept;
  estCompletionISO: string;
  estCompletionLabel: string;
  daysUntil: number;
  value: number;
}

/* ============ Per-resource personal schedule ============ */

export interface Resource {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
  department: string;
  trade: string;
  resourceNumber: string;
}

export type JobStatus = "Not started" | "In progress" | "Blocked" | "Done";
export type WeekBucket = "This week" | "Next week";

export interface ScheduledJob {
  id: string;
  jobNumber: string;
  customer: string;
  scope: string;
  priority: number;
  weekBucket: WeekBucket;
  startLabel: string;
  dueLabel: string;
  estimatedHours: number;
  actualHours: number;
  status: JobStatus;
  partnerLabel?: string;
}
