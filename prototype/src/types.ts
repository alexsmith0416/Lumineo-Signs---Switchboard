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
