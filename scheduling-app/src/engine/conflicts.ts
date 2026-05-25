import type { Conflict, ScheduleContext, ScheduleLine } from "./types";

export function detectConflicts(ctx: ScheduleContext): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const line of ctx.schedule) {
    if (line.customerDueDate && line.endDateTime > line.customerDueDate) {
      conflicts.push({
        type: "past-due",
        lineId: line.id,
        message: `${line.jobNo} ends after customer due date`,
      });
    }
  }

  const byEmployee = new Map<string, ScheduleLine[]>();
  for (const line of ctx.schedule) {
    const list = byEmployee.get(line.employeeId) ?? [];
    list.push(line);
    byEmployee.set(line.employeeId, list);
  }

  for (const lines of byEmployee.values()) {
    const sorted = [...lines].sort(
      (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime(),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      if (b.startDateTime < a.endDateTime) {
        conflicts.push({
          type: "employee-overlap",
          lineId: b.id,
          relatedLineId: a.id,
          message: `Overlap on employee schedule`,
        });
      }
    }
  }

  const byJob = new Map<string, ScheduleLine[]>();
  for (const line of ctx.schedule) {
    const list = byJob.get(line.jobNo) ?? [];
    list.push(line);
    byJob.set(line.jobNo, list);
  }

  for (const lines of byJob.values()) {
    for (const line of lines) {
      const myDept = ctx.departments.get(line.departmentId);
      if (!myDept) continue;
      for (const other of lines) {
        if (other.id === line.id) continue;
        const otherDept = ctx.departments.get(other.departmentId);
        if (!otherDept) continue;
        if (
          otherDept.flowOrder < myDept.flowOrder &&
          line.startDateTime < other.endDateTime
        ) {
          conflicts.push({
            type: "department-order",
            lineId: line.id,
            relatedLineId: other.id,
            message: `${line.jobNo} starts ${myDept.name} before ${otherDept.name} ends`,
          });
        }
      }
    }
  }

  return conflicts;
}
