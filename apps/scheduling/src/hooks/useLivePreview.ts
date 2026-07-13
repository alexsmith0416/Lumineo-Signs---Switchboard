import { useMemo } from "react";
import { calculateEndTime } from "../engine/time-walker";
import { useScheduleStore, type UseScheduleStore } from "../store/schedule-store";

interface LivePreview {
  start: Date | null;
  end: Date | null;
  effectiveHours: number;
}

export function useLivePreview(
  start: Date | null,
  estimatedHours: number,
  overrideHours: number | null,
  employeeId: string | null,
  useStore: UseScheduleStore = useScheduleStore,
  /** When editing an EXISTING line, its id — so its own hours aren't
   *  double-counted against the day's capacity (which would push the end
   *  later than the real, saved end). */
  ignoreLineId?: string,
): LivePreview {
  const employees = useStore((s) => s.employees);
  const departments = useStore((s) => s.departments);
  const schedule = useStore((s) => s.schedule);
  const workHours = useStore((s) => s.workHours);
  const overtime = useStore((s) => s.overtime);

  return useMemo(() => {
    if (!start || !employeeId) {
      return { start, end: null, effectiveHours: 0 };
    }
    const emp = employees.get(employeeId);
    if (!emp) return { start, end: null, effectiveHours: 0 };

    const rawHours = overrideHours ?? estimatedHours;
    const rate = emp.productivityRate === 0 ? 1 : emp.productivityRate;
    const eff = rawHours / rate;
    const end = calculateEndTime(
      start,
      eff,
      emp,
      { employees, departments, schedule, workHours, overtime },
      ignoreLineId,
    );
    return { start, end, effectiveHours: eff };
  }, [start, estimatedHours, overrideHours, employeeId, employees, departments, schedule, workHours, overtime, ignoreLineId]);
}
