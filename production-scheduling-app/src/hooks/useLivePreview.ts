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
    const end = calculateEndTime(start, eff, emp, {
      employees,
      departments,
      schedule,
      workHours,
      overtime,
    });
    return { start, end, effectiveHours: eff };
  }, [start, estimatedHours, overrideHours, employeeId, employees, departments, schedule, workHours, overtime]);
}
