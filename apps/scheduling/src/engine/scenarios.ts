import { cloneContext, shiftTask, updateDuration } from "./cascade";
import { calculateEndTime } from "./time-walker";
import { effectiveHours } from "./capacity";
import { detectConflicts } from "./conflicts";
import type {
  CommitPatch,
  CommitResult,
  ScenarioChange,
  ScenarioResult,
  ScheduleContext,
  ScheduleLine,
} from "./types";

const RUSH_ID_PREFIX = "rush-";

export function runScenario(
  base: ScheduleContext,
  changes: ScenarioChange[],
): ScenarioResult {
  const baseSnapshot = cloneContext(base);
  let scenario = cloneContext(base);
  const newLineIds = new Set<string>();
  const movedLineIds = new Set<string>();

  let rushCounter = 0;

  for (const change of changes) {
    switch (change.type) {
      case "shift-task": {
        const r = shiftTask(
          scenario,
          change.lineId,
          change.newStart,
          change.newEmployeeId,
          { cascade: true },
        );
        scenario = r.context;
        r.moved.forEach((id) => movedLineIds.add(id));
        break;
      }
      case "update-duration": {
        const r = updateDuration(scenario, change.lineId, change.overrideHours, true);
        scenario = r.context;
        r.moved.forEach((id) => movedLineIds.add(id));
        break;
      }
      case "add-overtime": {
        scenario.overtime.push({
          employeeId: change.employeeId,
          date: change.date,
          extraHours: change.extraHours,
          costMultiplier: change.costMultiplier ?? 1.5,
        });
        rebuildEndTimesForEmployee(scenario, change.employeeId, movedLineIds);
        break;
      }
      case "enable-weekends": {
        const emp = scenario.employees.get(change.employeeId);
        if (emp) {
          scenario.employees.set(change.employeeId, { ...emp, worksWeekends: true });
        }
        rebuildEndTimesForEmployee(scenario, change.employeeId, movedLineIds);
        break;
      }
      case "insert-rush-job": {
        let cursor = new Date(change.earliestStart);
        for (const task of change.tasks) {
          const id = `${RUSH_ID_PREFIX}${change.jobNo}-${rushCounter++}`;
          const emp = scenario.employees.get(task.employeeId);
          const start = new Date(cursor);
          const newLine: ScheduleLine = {
            id,
            jobNo: change.jobNo,
            customerName: change.customerName,
            planningLineDescription: task.planningLineDescription,
            startDateTime: start,
            endDateTime: start,
            estimatedHours: task.estimatedHours,
            overrideHours: null,
            employeeId: task.employeeId,
            departmentId: task.departmentId,
            customerDueDate: change.customerDueDate,
            isLocked: false,
            jobSequence: rushCounter,
          };
          if (emp) {
            newLine.endDateTime = calculateEndTime(
              start,
              effectiveHours(newLine, emp),
              emp,
              scenario,
            );
          }
          scenario.schedule.push(newLine);
          newLineIds.add(id);
          cursor = new Date(newLine.endDateTime);
        }
        break;
      }
    }
  }

  return {
    base: baseSnapshot,
    scenario,
    changes,
    movedLineIds,
    newLineIds,
    conflicts: detectConflicts(scenario),
  };
}

function rebuildEndTimesForEmployee(
  ctx: ScheduleContext,
  employeeId: string,
  movedLineIds: Set<string>,
): void {
  const emp = ctx.employees.get(employeeId);
  if (!emp) return;
  for (const line of ctx.schedule) {
    if (line.employeeId !== employeeId) continue;
    const newEnd = calculateEndTime(
      line.startDateTime,
      effectiveHours(line, emp),
      emp,
      ctx,
      line.id,
    );
    if (newEnd.getTime() !== line.endDateTime.getTime()) {
      line.endDateTime = newEnd;
      movedLineIds.add(line.id);
    }
  }
}

export function commitScenario(
  base: ScheduleContext,
  result: ScenarioResult,
): CommitResult {
  const patches: CommitPatch[] = [];
  const baseById = new Map(base.schedule.map((l) => [l.id, l]));

  for (const line of result.scenario.schedule) {
    if (result.newLineIds.has(line.id)) {
      patches.push({
        lineId: line.id,
        isInsert: true,
        changes: { ...line },
      });
      continue;
    }
    const original = baseById.get(line.id);
    if (!original) continue;
    if (
      original.startDateTime.getTime() !== line.startDateTime.getTime() ||
      original.endDateTime.getTime() !== line.endDateTime.getTime() ||
      original.overrideHours !== line.overrideHours ||
      original.employeeId !== line.employeeId
    ) {
      patches.push({
        lineId: line.id,
        isInsert: false,
        changes: {
          startDateTime: line.startDateTime,
          endDateTime: line.endDateTime,
          overrideHours: line.overrideHours,
          employeeId: line.employeeId,
          departmentId: line.departmentId,
        },
      });
    }
  }

  return { patches };
}

export interface ImpactMetrics {
  rescuedJobs: string[];
  pushedJobs: string[];
  nowPastDue: string[];
  overtimeCostDelta: number;
  movedCount: number;
  newCount: number;
}

export function computeImpact(result: ScenarioResult): ImpactMetrics {
  const baseConflicts = detectConflicts(result.base);
  const sceConflicts = result.conflicts;

  const basePastDueJobs = new Set(
    baseConflicts
      .filter((c) => c.type === "past-due")
      .map((c) => lineJob(result.base, c.lineId))
      .filter(Boolean) as string[],
  );
  const scePastDueJobs = new Set(
    sceConflicts
      .filter((c) => c.type === "past-due")
      .map((c) => lineJob(result.scenario, c.lineId))
      .filter(Boolean) as string[],
  );

  const rescuedJobs = [...basePastDueJobs].filter((j) => !scePastDueJobs.has(j));
  const nowPastDue = [...scePastDueJobs].filter((j) => !basePastDueJobs.has(j));

  const baseEndByJob = endByJob(result.base);
  const sceEndByJob = endByJob(result.scenario);
  const pushedJobs: string[] = [];
  for (const [job, sceEnd] of sceEndByJob.entries()) {
    const baseEnd = baseEndByJob.get(job);
    if (baseEnd && sceEnd.getTime() > baseEnd.getTime()) {
      pushedJobs.push(job);
    }
  }

  let overtimeCostDelta = 0;
  for (const ot of result.scenario.overtime) {
    const existed = result.base.overtime.find(
      (o) => o.employeeId === ot.employeeId && o.date === ot.date,
    );
    if (!existed) {
      const emp = result.scenario.employees.get(ot.employeeId);
      const rate = emp?.hourlyRate ?? 0;
      overtimeCostDelta += rate * ot.extraHours * (ot.costMultiplier ?? 1.5);
    }
  }

  return {
    rescuedJobs,
    pushedJobs,
    nowPastDue,
    overtimeCostDelta,
    movedCount: result.movedLineIds.size,
    newCount: result.newLineIds.size,
  };
}

function lineJob(ctx: ScheduleContext, lineId: string): string | null {
  return ctx.schedule.find((l) => l.id === lineId)?.jobNo ?? null;
}

function endByJob(ctx: ScheduleContext): Map<string, Date> {
  const out = new Map<string, Date>();
  for (const line of ctx.schedule) {
    const cur = out.get(line.jobNo);
    if (!cur || line.endDateTime > cur) out.set(line.jobNo, line.endDateTime);
  }
  return out;
}
