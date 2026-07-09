import { create, type StoreApi, type UseBoundStore } from "zustand";
import { addDays, startOfWeek, endOfWeek } from "date-fns";
import { settleSchedule, diffShift, diffResize } from "../engine/cascade";
import { detectConflicts } from "../engine/conflicts";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { productionDataSource } from "../services/dataverse";
import {
  liveProductionDataSource,
  liveNekInstallDataSource,
  liveWkInstallDataSource,
} from "../services/dataverse-live";
import {
  nekInstallDataSource,
  wkInstallDataSource,
} from "../services/installation-data";
import { shippingDataSource } from "../services/shipping-data";
import type {
  ResourceAdminInput,
  ScheduleDataSource,
  ScheduleKind,
} from "../services/data-source";
import type {
  Conflict,
  Department,
  Employee,
  OvertimeOverride,
  ScheduleContext,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

export interface ScheduleStoreState {
  dataSource: ScheduleDataSource;
  weekStart: Date;
  loading: boolean;
  error: string | null;

  employees: Map<string, Employee>;
  departments: Map<string, Department>;
  schedule: ScheduleLine[];
  workHours: WorkHoursOverride[];
  overtime: OvertimeOverride[];
  conflicts: Conflict[];

  loadWeek: (weekStart?: Date) => Promise<void>;
  getContext: () => ScheduleContext;
  shiftTaskAndCommit: (
    lineId: string,
    newStart: Date,
    newEmployeeId?: string,
    cascade?: boolean,
  ) => Promise<void>;
  updateTaskHours: (lineId: string, overrideHours: number) => Promise<void>;
  addScheduleLine: (line: ScheduleLine) => Promise<void>;
  deleteScheduleLine: (lineId: string) => Promise<void>;
  setWeekStart: (date: Date) => void;
  /** Add a department in memory. Production wires this up to a Dataverse
   *  write through the data source. */
  addDepartment: (dept: Department) => void;
  /** Roster admin (right-click add/edit/delete). Persists to Dataverse when the
   *  source supports it then refreshes; mock sources mutate in-memory so dev
   *  still reflects the change. */
  createResource: (input: ResourceAdminInput) => Promise<void>;
  updateResource: (id: string, input: ResourceAdminInput) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  /** Batch roster edit (drag-reorder): persist all changes, then refresh once. */
  updateResources: (edits: Array<{ id: string; input: ResourceAdminInput }>) => Promise<void>;
}

/** Apply an admin input to an in-memory Employee (mock/dev fallback only). For
 *  installation the location/position/truck/CCO fields map onto the Employee;
 *  for production only name + department apply. */
function applyResourceInput(
  emp: Employee,
  input: ResourceAdminInput,
  kind: ScheduleKind,
): Employee {
  const out = { ...emp };
  if (input.name !== undefined) out.name = input.name;
  if (kind === "installation") {
    if (input.location !== undefined) out.departmentId = String(input.location);
    if (input.position !== undefined) out.position = Number(input.position);
    if (input.truckNumber !== undefined) out.truckNumber = input.truckNumber;
    if (input.isCertifiedCraneOperator !== undefined)
      out.isCertifiedCraneOperator = input.isCertifiedCraneOperator;
  } else if (input.departmentId !== undefined) {
    out.departmentId = input.departmentId;
  }
  return out;
}

function buildContext(state: ScheduleStoreState): ScheduleContext {
  return {
    employees: state.employees,
    departments: state.departments,
    schedule: state.schedule,
    workHours: state.workHours,
    overtime: state.overtime,
  };
}

export type UseScheduleStore = UseBoundStore<StoreApi<ScheduleStoreState>>;

export function createScheduleStore(
  dataSource: ScheduleDataSource,
): UseScheduleStore {
  return create<ScheduleStoreState>((set, get) => ({
    dataSource,
    weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
    loading: false,
    error: null,
    employees: new Map(),
    departments: new Map(),
    schedule: [],
    workHours: [],
    overtime: [],
    conflicts: [],

    setWeekStart: (date) => {
      set({ weekStart: startOfWeek(date, { weekStartsOn: 1 }) });
    },

    loadWeek: async (weekStart) => {
      const start = startOfWeek(weekStart ?? get().weekStart, { weekStartsOn: 1 });
      const end = endOfWeek(addDays(start, 6), { weekStartsOn: 1 });
      set({ loading: true, error: null, weekStart: start });
      try {
        const ds = get().dataSource;
        const [departments, employees, schedule, workHours, overtime] = await Promise.all([
          ds.loadDepartments(),
          ds.loadEmployees(),
          ds.loadScheduleLines(start, end),
          ds.loadWorkHours(start, end),
          ds.loadOvertimeOverrides(start, end),
        ]);
        const empMap = new Map(employees.map((e) => [e.id, e]));
        const deptMap = new Map(departments.map((d) => [d.id, d]));
        const ctxForNormalize: ScheduleContext = {
          employees: empMap,
          departments: deptMap,
          schedule,
          workHours,
          overtime,
        };
        // Reconcile stored end times with engine math — handles drift from
        // schema changes (new productivityRate column) and legacy rows.
        // Also seeds `preferredStart` to the loaded position when absent,
        // so the cascade has a "user-intended" floor to pull tasks back to.
        const normalized = schedule.map((line) => {
          const emp = empMap.get(line.employeeId);
          const seededPreferred =
            line.preferredStart instanceof Date
              ? line
              : { ...line, preferredStart: new Date(line.startDateTime) };
          if (!emp) return seededPreferred;
          const engineEnd = calculateEndTime(
            seededPreferred.startDateTime,
            effectiveHours(seededPreferred, emp),
            emp,
            ctxForNormalize,
            seededPreferred.id,
          );
          return engineEnd.getTime() === seededPreferred.endDateTime.getTime()
            ? seededPreferred
            : { ...seededPreferred, endDateTime: engineEnd };
        });
        // Settle the loaded board to the cascade fixpoint so it opens
        // conflict-free (loaded data is rarely already settled: overlapping
        // queues, legacy dept-order drift). The engine is idempotent, so a
        // settled board is a true fixpoint; on top of that, the confirm dialog
        // and commit isolate each change via `diffShift` (move-vs-noop), so a
        // drag still reports only the moves it actually causes.
        const settled = settleSchedule({ ...ctxForNormalize, schedule: normalized });
        set({
          employees: empMap,
          departments: deptMap,
          schedule: settled.schedule,
          workHours,
          overtime,
          conflicts: detectConflicts(settled),
          loading: false,
        });
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : String(err) });
      }
    },

    getContext: () => buildContext(get()),

    shiftTaskAndCommit: async (lineId, newStart, newEmployeeId, cascade = true) => {
      const state = get();
      const ctx = buildContext(state);
      // Differential commit: persist + apply only the genuinely-affected
      // tasks, leaving unrelated tasks exactly where they were. This is the
      // same isolation the confirm dialog shows, so what the user approves is
      // precisely what gets written (no ambient cascade churn).
      const diff = diffShift(ctx, lineId, newStart, newEmployeeId, { cascade });
      const ds = state.dataSource;
      const toPersist = [diff.target, ...diff.changed].filter(
        (l): l is NonNullable<typeof l> => l != null,
      );
      await Promise.all(
        toPersist.map((line) =>
          ds.updateScheduleLine(line.id, {
            startDateTime: line.startDateTime,
            endDateTime: line.endDateTime,
            employeeId: line.employeeId,
            departmentId: line.departmentId,
          }),
        ),
      );

      set({
        schedule: diff.committed.schedule,
        conflicts: diff.conflicts,
      });
    },

    updateTaskHours: async (lineId, overrideHours) => {
      const state = get();
      const ctx = buildContext(state);
      const diff = diffResize(ctx, lineId, overrideHours, true);
      const ds = state.dataSource;
      const toPersist = [diff.target, ...diff.changed].filter(
        (l): l is NonNullable<typeof l> => l != null,
      );
      await Promise.all(
        toPersist.map((line) =>
          ds.updateScheduleLine(line.id, {
            startDateTime: line.startDateTime,
            endDateTime: line.endDateTime,
            overrideHours: line.overrideHours,
          }),
        ),
      );

      set({
        schedule: diff.committed.schedule,
        conflicts: diff.conflicts,
      });
    },

    addScheduleLine: async (line) => {
      const ds = get().dataSource;
      const created = await ds.createScheduleLine(line);
      const next = [...get().schedule, created];
      const ctx: ScheduleContext = { ...buildContext(get()), schedule: next };
      set({
        schedule: next,
        conflicts: detectConflicts(ctx),
      });
    },

    deleteScheduleLine: async (lineId) => {
      const ds = get().dataSource;
      await ds.deleteScheduleLine(lineId);
      const next = get().schedule.filter((l) => l.id !== lineId);
      const ctx: ScheduleContext = { ...buildContext(get()), schedule: next };
      set({
        schedule: next,
        conflicts: detectConflicts(ctx),
      });
    },

    addDepartment: (dept) => {
      const next = new Map(get().departments);
      next.set(dept.id, dept);
      set({ departments: next });
    },

    createResource: async (input) => {
      const ds = get().dataSource;
      if (ds.createResource) {
        await ds.createResource(input);
        await get().loadWeek();
        return;
      }
      // Mock/dev: synthesize a local roster row so the board updates.
      const id = `local-${Math.random().toString(36).slice(2)}`;
      const base: Employee = {
        id,
        name: input.name ?? "New",
        departmentId: "",
        productivityRate: 1,
        standardHoursPerDay: 8,
        maxOvertimePerDay: 0,
        worksWeekends: false,
      };
      const next = new Map(get().employees);
      next.set(id, applyResourceInput(base, input, ds.kind));
      set({ employees: next });
    },

    updateResource: async (id, input) => {
      const ds = get().dataSource;
      if (ds.updateResource) {
        // Live: persist then reload. A region change correctly drops the row
        // from this store (loadEmployees re-filters by region on reload).
        await ds.updateResource(id, input);
        await get().loadWeek();
        return;
      }
      const next = new Map(get().employees);
      const cur = next.get(id);
      if (!cur) return;
      next.set(id, applyResourceInput(cur, input, ds.kind));
      set({ employees: next });
    },

    deleteResource: async (id) => {
      const ds = get().dataSource;
      if (ds.deleteResource) {
        await ds.deleteResource(id);
        await get().loadWeek();
        return;
      }
      const next = new Map(get().employees);
      next.delete(id);
      set({ employees: next });
    },

    updateResources: async (edits) => {
      if (edits.length === 0) return;
      const ds = get().dataSource;
      if (ds.updateResource) {
        await Promise.all(edits.map((e) => ds.updateResource!(e.id, e.input)));
        await get().loadWeek();
        return;
      }
      const next = new Map(get().employees);
      for (const e of edits) {
        const cur = next.get(e.id);
        if (cur) next.set(e.id, applyResourceInput(cur, e.input, ds.kind));
      }
      set({ employees: next });
    },
  }));
}

// Production store data source:
//  - deployed (production build, runs in the Power Apps host) → live Dataverse
//  - VITE_DATA_SOURCE=live (forced, e.g. local `pac code run`) → live Dataverse
//  - otherwise (plain `npm run dev` / tests) → in-memory mock
// Importing liveProductionDataSource is side-effect-free — its SDK loads lazily
// on first call — so this selection never touches the Power runtime in dev.
const useLiveData =
  import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const productionSource = useLiveData ? liveProductionDataSource : productionDataSource;
// Installation roster reads live from crfdf_InstallationEmployees (WK = region
// false, NEK = region true) when deployed / forced; mock crews otherwise.
const wkInstallSource = useLiveData ? liveWkInstallDataSource : wkInstallDataSource;
const nekInstallSource = useLiveData ? liveNekInstallDataSource : nekInstallDataSource;

export const useScheduleStore = createScheduleStore(productionSource);
export const useInstallationStore = createScheduleStore(wkInstallSource);
export const useInstallationStoreWK = createScheduleStore(wkInstallSource);
export const useInstallationStoreNEK = createScheduleStore(nekInstallSource);
export const useShippingStore = createScheduleStore(shippingDataSource);
