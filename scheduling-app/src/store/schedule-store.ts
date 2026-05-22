import { create } from "zustand";
import { addDays, startOfWeek, endOfWeek } from "date-fns";
import { dataverseService } from "../services/dataverse";
import { shiftTask, updateDuration } from "../engine/cascade";
import { detectConflicts } from "../engine/conflicts";
import type {
  Conflict,
  Department,
  Employee,
  OvertimeOverride,
  ScheduleContext,
  ScheduleLine,
  WorkHoursOverride,
} from "../engine/types";

interface ScheduleStoreState {
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

export const useScheduleStore = create<ScheduleStoreState>((set, get) => ({
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
      const [departments, employees, schedule, workHours, overtime] = await Promise.all([
        dataverseService.loadDepartments(),
        dataverseService.loadEmployees(),
        dataverseService.loadScheduleLines(start, end),
        dataverseService.loadWorkHours(start, end),
        dataverseService.loadOvertimeOverrides(start, end),
      ]);
      const empMap = new Map(employees.map((e) => [e.id, e]));
      const deptMap = new Map(departments.map((d) => [d.id, d]));
      const ctx: ScheduleContext = {
        employees: empMap,
        departments: deptMap,
        schedule,
        workHours,
        overtime,
      };
      set({
        employees: empMap,
        departments: deptMap,
        schedule,
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
    const ctx = buildContext(get());
    const result = shiftTask(ctx, lineId, newStart, newEmployeeId, {
      cascade,
      previewOnly: false,
    });

    const movedSet = new Set(result.moved);
    await Promise.all(
      result.context.schedule
        .filter((line) => movedSet.has(line.id))
        .map((line) =>
          dataverseService.updateScheduleLine(line.id, {
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
    const ctx = buildContext(get());
    const result = updateDuration(ctx, lineId, overrideHours, true);
    const movedSet = new Set(result.moved);

    await Promise.all(
      result.context.schedule
        .filter((line) => movedSet.has(line.id) || line.id === lineId)
        .map((line) =>
          dataverseService.updateScheduleLine(line.id, {
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
    const created = await dataverseService.createScheduleLine(line);
    const next = [...get().schedule, created];
    const ctx: ScheduleContext = { ...buildContext(get()), schedule: next };
    set({
      schedule: next,
      conflicts: detectConflicts(ctx),
    });
  },
}));
