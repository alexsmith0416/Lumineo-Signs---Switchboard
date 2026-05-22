import { useMemo } from "react";
import { calculateEndTime } from "../engine/time-walker";
import { useScheduleStore } from "../store/schedule-store";

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
): LivePreview {
  const employees = useScheduleStore((s) => s.employees);
  const context = useScheduleStore((s) => s.getContext());

  return useMemo(() => {
    if (!start || !employeeId) {
      return { start, end: null, effectiveHours: 0 };
    }
    const emp = employees.get(employeeId);
    if (!emp) return { start, end: null, effectiveHours: 0 };

    const rawHours = overrideHours ?? estimatedHours;
    const rate = emp.productivityRate === 0 ? 1 : emp.productivityRate;
    const eff = rawHours / rate;
    const end = calculateEndTime(start, eff, emp, context);
    return { start, end, effectiveHours: eff };
  }, [start, estimatedHours, overrideHours, employeeId, employees, context]);
}
