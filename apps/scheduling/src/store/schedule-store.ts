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
import { isLaneEmployeeId, laneDeptId, laneEmployeesFor } from "../services/department-lane";
import { useSettingsStore } from "./settings-store";
import { useHistoryStore } from "./history-store";
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
  /** Stable id for this board's undo/redo history (see history-store). */
  boardId: string;
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
  updateTaskHours: (lineId: string, overrideHours: number, cascade?: boolean) => Promise<void>;
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
  // Merge synthetic department-lane resources so team lines (departmentWide)
  // resolve to a resource for the engine. These are never stored in
  // state.employees — the real roster stays person-only for the UI.
  const lanes = laneEmployeesFor(state.schedule, state.departments);
  const employees = lanes.size
    ? new Map([...state.employees, ...lanes])
    : state.employees;
  return {
    employees,
    departments: state.departments,
    schedule: state.schedule,
    workHours: state.workHours,
    overtime: state.overtime,
  };
}

export type UseScheduleStore = UseBoundStore<StoreApi<ScheduleStoreState>>;

export function createScheduleStore(
  dataSource: ScheduleDataSource,
  boardId: string,
): UseScheduleStore {
  return create<ScheduleStoreState>((set, get) => {
    // --- Write pipeline ----------------------------------------------------
    // Every Dataverse mutation goes through here so that:
    //  (a) writes to the SAME line apply in submission order — a later intended
    //      edit never loses the race to an earlier in-flight one (this is what
    //      made a manual start/end date change fail ~half the time: a resize
    //      write carrying the OLD start could land after the shift write with
    //      the NEW start), and
    //  (b) loadWeek() can wait for all in-flight writes before it re-reads —
    //      otherwise a "quick reload" races the optimistic write and reads
    //      stale data, silently reverting the edit (so it only "took" on the
    //      2nd try).
    // Optimism is unchanged: callers still set() the board immediately; only the
    // background persistence is coordinated here.
    const inFlight = new Set<Promise<unknown>>();
    const writeTails = new Map<string, Promise<unknown>>();

    /** Register a persist promise so settleWrites() can await it. */
    const track = <T>(p: Promise<T>): Promise<T> => {
      inFlight.add(p);
      const clear = () => inFlight.delete(p);
      p.then(clear, clear);
      return p;
    };

    /** Queue a persist keyed by line id: same-id writes run in order (each
     *  starts only once the previous one settles); different ids run
     *  concurrently. The returned promise rejects if `op` rejects, so callers
     *  can resync on failure. */
    const queueWrite = (key: string, op: () => Promise<unknown>): Promise<unknown> => {
      const prev = writeTails.get(key) ?? Promise.resolve();
      const run = prev.then(op, op); // run op after prev settles, either way
      writeTails.set(key, run);
      const clear = () => {
        if (writeTails.get(key) === run) writeTails.delete(key);
      };
      run.then(clear, clear);
      return track(run);
    };

    /** Resolve once every in-flight write has settled (success or failure).
     *  loadWeek awaits this so a reload never reads mid-write. */
    const settleWrites = () => Promise.allSettled([...inFlight]);

    /** Restore a full schedule snapshot locally + re-persist the affected lines
     *  to Dataverse. Shared by every undo/redo thunk. */
    const applyScheduleSnapshot = (
      sched: ScheduleLine[],
      persist: () => Promise<unknown>,
    ) => {
      const s = get();
      const lanes = laneEmployeesFor(sched, s.departments);
      const employees = lanes.size ? new Map([...s.employees, ...lanes]) : s.employees;
      const ctx: ScheduleContext = {
        employees,
        departments: s.departments,
        schedule: sched,
        workHours: s.workHours,
        overtime: s.overtime,
      };
      set({ schedule: sched, conflicts: detectConflicts(ctx) });
      void track(persist()).catch((e) => {
        console.error("[schedule] undo/redo persist failed — resyncing", e);
        void get().loadWeek();
      });
    };

    /** Record one undoable edit: `before`/`after` are full-board snapshots for
     *  local state; `undoPersist`/`redoPersist` write the affected lines back. */
    const recordEdit = (
      label: string,
      before: ScheduleLine[],
      after: ScheduleLine[],
      undoPersist: () => Promise<unknown>,
      redoPersist: () => Promise<unknown>,
    ) => {
      useHistoryStore.getState().record(boardId, {
        label,
        undo: () => applyScheduleSnapshot(before, undoPersist),
        redo: () => applyScheduleSnapshot(after, redoPersist),
      });
    };

    return {
    dataSource,
    boardId,
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
      // Never read mid-write: wait for any optimistic edits still persisting so
      // the reload can't overwrite them with stale server data.
      await settleWrites();
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
        // Engine map also carries the synthetic department-lane resources so
        // team lines recompute their end times and cascade. state.employees
        // (set below) stays person-only.
        const lanes = laneEmployeesFor(schedule, deptMap);
        const engineEmpMap = lanes.size ? new Map([...empMap, ...lanes]) : empMap;
        const ctxForNormalize: ScheduleContext = {
          employees: engineEmpMap,
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
          const emp = engineEmpMap.get(line.employeeId);
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
        //
        // When the user has turned cascade OFF (full-override mode), skip the
        // settle so the board keeps its stored positions exactly — overlaps just
        // surface a conflict icon instead of tasks auto-moving.
        const normalizedCtx = { ...ctxForNormalize, schedule: normalized };
        const final = useSettingsStore.getState().cascadeEnabled
          ? settleSchedule(normalizedCtx)
          : normalizedCtx;
        set({
          employees: empMap,
          departments: deptMap,
          schedule: final.schedule,
          workHours,
          overtime,
          conflicts: detectConflicts(final),
          loading: false,
        });
        // Fresh board — prior undo snapshots would replay against stale data.
        useHistoryStore.getState().clear(boardId);
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

      // Dropping a card onto the shared department lane converts it to a team
      // job (departmentWide); dropping it back onto a person makes it an
      // individual job again. Keep departmentId consistent with the drop target.
      const convert =
        newEmployeeId !== undefined
          ? {
              departmentWide: isLaneEmployeeId(newEmployeeId) || undefined,
              departmentId: isLaneEmployeeId(newEmployeeId)
                ? laneDeptId(newEmployeeId)
                : state.employees.get(newEmployeeId)?.departmentId,
            }
          : null;
      const applyConvert = (l: ScheduleLine): ScheduleLine =>
        convert && l.id === lineId
          ? {
              ...l,
              departmentWide: convert.departmentWide,
              departmentId: convert.departmentId ?? l.departmentId,
            }
          : l;
      const oldWide = !!state.schedule.find((l) => l.id === lineId)?.departmentWide;
      const boundaryChanged = !!convert && oldWide !== !!convert.departmentWide;

      const toPersist = [diff.target, ...diff.changed]
        .filter((l): l is NonNullable<typeof l> => l != null)
        .map(applyConvert);
      const beforeSchedule = state.schedule;
      const afterSchedule = convert
        ? diff.committed.schedule.map(applyConvert)
        : diff.committed.schedule;
      // Optimistic: move the card on the board immediately, then persist the
      // affected lines to Dataverse in the background (resync on failure).
      set({
        schedule: afterSchedule,
        conflicts: diff.conflicts,
      });
      // Record undo/redo (skip boundary crossings — they reload the board,
      // which clears history anyway). Undo re-writes the affected lines' old
      // positions; redo re-writes the new ones.
      if (!boundaryChanged) {
        const beforeById = new Map(beforeSchedule.map((l) => [l.id, l]));
        const shiftPayload = (l: ScheduleLine) => ({
          startDateTime: l.startDateTime,
          endDateTime: l.endDateTime,
          employeeId: l.employeeId,
          departmentId: l.departmentId,
          departmentWide: l.departmentWide ?? false,
        });
        recordEdit(
          "Move",
          beforeSchedule,
          afterSchedule,
          () =>
            Promise.all(
              toPersist.map((l) => {
                const b = beforeById.get(l.id);
                return b ? ds.updateScheduleLine(b.id, shiftPayload(b)) : Promise.resolve();
              }),
            ),
          () => Promise.all(toPersist.map((l) => ds.updateScheduleLine(l.id, shiftPayload(l)))),
        );
      }
      await Promise.all(
        toPersist.map((line) =>
          queueWrite(line.id, () =>
            ds.updateScheduleLine(line.id, {
              startDateTime: line.startDateTime,
              endDateTime: line.endDateTime,
              employeeId: line.employeeId,
              departmentId: line.departmentId,
              departmentWide: line.departmentWide ?? false,
            }),
          ),
        ),
      )
        .then(() => {
          // A team/individual boundary crossing changes which resource owns the
          // line — reload so the lane resource is present and the board settles
          // to a true fixpoint (end times, lane membership).
          if (boundaryChanged) void get().loadWeek();
        })
        .catch((e) => {
          console.error("[schedule] shift persist failed — resyncing", e);
          void get().loadWeek();
        });
    },

    updateTaskHours: async (lineId, overrideHours, cascade = true) => {
      const state = get();
      const ctx = buildContext(state);
      // cascade=false (full-override / "move only this") resizes just this task;
      // still optimistic — no full reload — so the card grows in place.
      const diff = diffResize(ctx, lineId, overrideHours, cascade, true);
      const ds = state.dataSource;
      const toPersist = [diff.target, ...diff.changed].filter(
        (l): l is NonNullable<typeof l> => l != null,
      );
      const beforeSchedule = state.schedule;
      const afterSchedule = diff.committed.schedule;
      // Optimistic: resize on the board immediately, persist in the background.
      set({ schedule: afterSchedule, conflicts: diff.conflicts });
      const beforeById = new Map(beforeSchedule.map((l) => [l.id, l]));
      const resizePayload = (l: ScheduleLine) => ({
        startDateTime: l.startDateTime,
        endDateTime: l.endDateTime,
        overrideHours: l.overrideHours,
      });
      recordEdit(
        "Resize",
        beforeSchedule,
        afterSchedule,
        () =>
          Promise.all(
            toPersist.map((l) => {
              const b = beforeById.get(l.id);
              return b ? ds.updateScheduleLine(b.id, resizePayload(b)) : Promise.resolve();
            }),
          ),
        () => Promise.all(toPersist.map((l) => ds.updateScheduleLine(l.id, resizePayload(l)))),
      );
      await Promise.all(
        toPersist.map((line) =>
          queueWrite(line.id, () =>
            ds.updateScheduleLine(line.id, {
              startDateTime: line.startDateTime,
              endDateTime: line.endDateTime,
              overrideHours: line.overrideHours,
            }),
          ),
        ),
      ).catch((e) => {
        console.error("[schedule] resize persist failed — resyncing", e);
        void get().loadWeek();
      });
    },

    addScheduleLine: async (line) => {
      const ds = get().dataSource;
      // Optimistic: show the new card immediately, persist in the background.
      // Live createScheduleLine returns the same line (id preserved).
      const beforeSchedule = get().schedule;
      const next = [...beforeSchedule, line];
      const ctx: ScheduleContext = { ...buildContext(get()), schedule: next };
      set({ schedule: next, conflicts: detectConflicts(ctx) });
      recordEdit(
        "Add job",
        beforeSchedule,
        next,
        () => ds.deleteScheduleLine(line.id),
        () => ds.createScheduleLine(line),
      );
      await queueWrite(line.id, () => ds.createScheduleLine(line)).catch((e) => {
        console.error("[schedule] create persist failed — resyncing", e);
        void get().loadWeek();
      });
    },

    deleteScheduleLine: async (lineId) => {
      const ds = get().dataSource;
      // Optimistic: remove the card immediately, persist the delete in the
      // background (resync on failure so a failed delete reappears).
      const beforeSchedule = get().schedule;
      const removed = beforeSchedule.find((l) => l.id === lineId);
      const next = beforeSchedule.filter((l) => l.id !== lineId);
      const ctx: ScheduleContext = { ...buildContext(get()), schedule: next };
      set({ schedule: next, conflicts: detectConflicts(ctx) });
      if (removed) {
        recordEdit(
          "Delete job",
          beforeSchedule,
          next,
          () => ds.createScheduleLine(removed),
          () => ds.deleteScheduleLine(removed.id),
        );
      }
      await queueWrite(lineId, () => ds.deleteScheduleLine(lineId)).catch((e) => {
        console.error("[schedule] delete persist failed — resyncing", e);
        void get().loadWeek();
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
    };
  });
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

export const useScheduleStore = createScheduleStore(productionSource, "production");
export const useInstallationStore = createScheduleStore(wkInstallSource, "install-wk");
export const useInstallationStoreWK = createScheduleStore(wkInstallSource, "install-wk");
export const useInstallationStoreNEK = createScheduleStore(nekInstallSource, "install-nek");
export const useShippingStore = createScheduleStore(shippingDataSource, "shipping");
