import type { EmployeeGroup, FloorGroup } from "./current-user";
import {
  useScheduleStore,
  useInstallationStoreWK,
  useInstallationStoreNEK,
  type UseScheduleStore,
} from "../store/schedule-store";

/** The roster store backing each employee group. */
export const GROUP_STORES: Record<EmployeeGroup, UseScheduleStore> = {
  production: useScheduleStore,
  "install-wk": useInstallationStoreWK,
  "install-nek": useInstallationStoreNEK,
};

export const GROUP_LABELS: Record<EmployeeGroup, string> = {
  production: "Production",
  "install-wk": "Install · WK",
  "install-nek": "Install · NEK",
};

/** Tabs the admin "Employee Schedules" browser shows. */
export const ADMIN_TABS: EmployeeGroup[] = ["production", "install-wk", "install-nek"];

/** Which employee groups a shared floor login can pick a name from. */
export const FLOOR_GROUPS: Record<FloorGroup, EmployeeGroup[]> = {
  production: ["production"],
  install: ["install-wk", "install-nek"],
};
