import type { Employee } from "../engine/types";

/**
 * Week-scoped roster overrides. When someone is reordered or moved to a
 * different department/location for "just this week", we store where they sit
 * for that (employee, week, board) instead of changing their permanent record.
 * The board overlays these on load — the override wins for that week only.
 *
 * departmentId doubles as the install "location" (install employees group by
 * a numeric location stored as a string); position is the install ordering
 * (padded string) or "" for production.
 */
export interface RosterOverride {
  id: string;
  employeeId: string;
  weekStart: string; // yyyy-mm-dd (Monday)
  boardKind: string; // "production" | "install-wk" | "install-nek"
  departmentId: string;
  position: string;
}

export interface RosterOverrideDataSource {
  load(boardKind: string, weekStart: string): Promise<RosterOverride[]>;
  /** One row per (employee, week, board): replaces any existing one. */
  upsert(o: RosterOverride): Promise<void>;
  /** Drop this person's override for the week (used when a move goes permanent). */
  clearFor(boardKind: string, weekStart: string, employeeId: string): Promise<void>;
}

export const newOverrideId = (): string => crypto.randomUUID();

/** Overlay overrides onto the loaded (permanent) roster for the current week. */
export function applyRosterOverrides(
  employees: Map<string, Employee>,
  overrides: RosterOverride[],
): Map<string, Employee> {
  if (overrides.length === 0) return employees;
  const next = new Map(employees);
  for (const o of overrides) {
    const e = next.get(o.employeeId);
    if (!e) continue;
    next.set(o.employeeId, {
      ...e,
      departmentId: o.departmentId || e.departmentId,
      position: o.position !== "" ? Number(o.position) : e.position,
    });
  }
  return next;
}

// --- Live source (Dataverse) -------------------------------------------------
const liveRosterOverrideDataSource: RosterOverrideDataSource = {
  async load(boardKind, weekStart) {
    const m = await import("./dataverse-live");
    return m.fetchRosterOverrides(boardKind, weekStart);
  },
  async upsert(o) {
    const m = await import("./dataverse-live");
    await m.upsertRosterOverride(o);
  },
  async clearFor(boardKind, weekStart, employeeId) {
    const m = await import("./dataverse-live");
    await m.deleteRosterOverrideFor(boardKind, weekStart, employeeId);
  },
};

// --- Mock source (dev / tests) — in-memory, persists for the session ---------
function createMockRosterOverrideDataSource(): RosterOverrideDataSource {
  let rows: RosterOverride[] = [];
  const key = (o: { boardKind: string; weekStart: string; employeeId: string }) =>
    `${o.boardKind}|${o.weekStart}|${o.employeeId}`;
  return {
    async load(boardKind, weekStart) {
      return rows.filter((o) => o.boardKind === boardKind && o.weekStart === weekStart).map((o) => ({ ...o }));
    },
    async upsert(o) {
      rows = rows.filter((r) => key(r) !== key(o));
      rows.push({ ...o });
    },
    async clearFor(boardKind, weekStart, employeeId) {
      rows = rows.filter((r) => key(r) !== key({ boardKind, weekStart, employeeId }));
    },
  };
}

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
let _mock: RosterOverrideDataSource | null = null;

export function getRosterOverrideDataSource(): RosterOverrideDataSource {
  if (LIVE) return liveRosterOverrideDataSource;
  if (!_mock) _mock = createMockRosterOverrideDataSource();
  return _mock;
}
