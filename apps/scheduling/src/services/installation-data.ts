import {
  NEK_CREWS,
  NEK_DEPARTMENTS,
  NEK_LINES,
  NEK_OVERTIME,
  NEK_WORK_HOURS,
  WK_CREWS,
  WK_DEPARTMENTS,
  WK_LINES,
  WK_OVERTIME,
  WK_WORK_HOURS,
} from "../data/mock-installation";
import { createMockDataSource } from "./data-source";
import { mockAssistCards, mockAssistEmployees } from "../data/mock-assist";
import type { Employee } from "../engine/types";
import {
  cacheAddCard,
  cacheRemoveCard,
  cacheUpdateCard,
  setRegionCards,
  type InstallRegionKey,
} from "./install-cards";
import type { ScheduleDataSource } from "./data-source";

/**
 * The live install source publishes every one of its cards to the shared
 * install-card cache, which is what the Shipping "Scheduled" badge and the
 * Production board's mirrored rows both read. The mock source didn't, so in dev
 * those features saw an empty cache and silently showed nothing. Wrap it so dev
 * behaves the same way.
 */
function withCardCache(
  source: ScheduleDataSource,
  region: InstallRegionKey,
  /** Extra roster rows resolved at CALL time — assist rows can be created while
   *  the app is running, and a list captured at import time would never show
   *  them (the live source re-reads the table, so it doesn't have this problem). */
  extraEmployees?: () => Employee[],
): ScheduleDataSource {
  return {
    ...source,
    async loadEmployees() {
      const base = await source.loadEmployees();
      return extraEmployees ? [...base, ...extraEmployees()] : base;
    },
    async loadScheduleLines(from: Date, to: Date) {
      const lines = await source.loadScheduleLines(from, to);
      setRegionCards(region, lines);
      return lines;
    },
    // Keep the cache in step with writes too, exactly as the live source does —
    // otherwise a card created in dev wouldn't reach the Production board's
    // mirror or the Shipping "Scheduled" badge until a reload.
    async createScheduleLine(line) {
      const created = await source.createScheduleLine(line);
      cacheAddCard(region, created);
      return created;
    },
    async updateScheduleLine(id, changes) {
      const updated = await source.updateScheduleLine(id, changes);
      cacheUpdateCard(region, id, updated);
      return updated;
    },
    async deleteScheduleLine(id) {
      await source.deleteScheduleLine(id);
      cacheRemoveCard(region, id);
    },
  };
}

export const wkInstallDataSource = withCardCache(
  createMockDataSource("installation", {
    departments: WK_DEPARTMENTS,
    employees: WK_CREWS,
    schedule: [...WK_LINES, ...mockAssistCards()],
    workHours: WK_WORK_HOURS,
    overtime: WK_OVERTIME,
  }),
  "wk",
  // Anyone lent from Production — see mock-assist.ts.
  mockAssistEmployees,
);

export const nekInstallDataSource = withCardCache(
  createMockDataSource("installation", {
    departments: NEK_DEPARTMENTS,
    employees: NEK_CREWS,
    schedule: NEK_LINES,
    workHours: NEK_WORK_HOURS,
    overtime: NEK_OVERTIME,
  }),
  "nek",
);

// Default — most existing imports point here.
export const installationDataSource = wkInstallDataSource;
