import { create, type StoreApi, type UseBoundStore } from "zustand";
import { addDays, startOfWeek, endOfWeek } from "date-fns";
import { shiftTask, updateDuration } from "../engine/cascade";
import { detectConflicts } from "../engine/conflicts";
import { calculateEndTime } from "../engine/time-walker";
import { effectiveHours } from "../engine/capacity";
import { productionDataSource } from "../services/dataverse";
import { installationDataSource } from "../services/installation-data";
import { shippingDataSource } from "../services/shipping-data";
import type { ScheduleDataSource } from "../services/data-source";
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
        const normalized = schedule.map((line) => {
          const emp = empMap.get(line.employeeId);
          if (!emp) return line;
          const engineEnd = calculateEndTime(
            line.startDateTime,
            effectiveHours(line, emp),
            emp,
            ctxForNormalize,
            line.id,
          );
          return engineEnd.getTime() === line.endDateTime.getTime()
            ? line
            : { ...line, endDateTime: engineEnd };
        });
        const ctx: ScheduleContext = { ...ctxForNormalize, schedule: normalized };
        set({
          employees: empMap,
          departments: deptMap,
          schedule: normalized,
          workHours,
          overtime,
          conflicts: detectConflicts(ctx),
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
      const result = shiftTask(ctx, lineId, newStart, newEmployeeId, {
        cascade,
        previewOnly: false,
      });

      const movedSet = new Set(result.moved);
      const ds = state.dataSource;
      await Promise.all(
        result.context.schedule
          .filter((line) => movedSet.has(line.id))
          .map((line) =>
            ds.updateScheduleLine(line.id, {
              startDateTime: line.startDateTime,
              endDateTime: line.endDateTime,
              employeeId: line.employeeId,
              departmentId: line.departmentId,
            }),
          ),
      );

      set({
        schedule: result.context.schedule,
        conflicts: result.conflicts,
      });
    },

    updateTaskHours: async (lineId, overrideHours) => {
      const state = get();
      const ctx = buildContext(state);
      const result = updateDuration(ctx, lineId, overrideHours, true);
      const movedSet = new Set(result.moved);

      const ds = state.dataSource;
      await Promise.all(
        result.context.schedule
          .filter((line) => movedSet.has(line.id) || line.id === lineId)
          .map((line) =>
            ds.updateScheduleLine(line.id, {
              startDateTime: line.startDateTime,
              endDateTime: line.endDateTime,
              overrideHours: line.overrideHours,
            }),
          ),
      );

      set({
        schedule: result.context.schedule,
        conflicts: result.conflicts,
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
  }));
}

export const useScheduleStore = createScheduleStore(productionDataSource);
export const useInstallationStore = createScheduleStore(installationDataSource);
export const useShippingStore = createScheduleStore(shippingDataSource);
