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
