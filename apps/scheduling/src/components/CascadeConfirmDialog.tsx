import { useEffect } from "react";
import { format } from "date-fns";
import type { ScheduleContext, ScheduleLine } from "../engine/types";
import type { DiffShiftResult } from "../engine/cascade";

export interface CascadeMove {
  line: ScheduleLine;
  beforeStart: Date;
  afterStart: Date;
  beforeEnd: Date;
  afterEnd: Date;
  reason: "department-flow" | "employee-queue" | "other";
}

export interface CascadePreview {
  targetLine: ScheduleLine;
  cascadedMoves: CascadeMove[];
}

/**
 * Turn a {@link DiffShiftResult} into the dialog's per-move rows. The diff has
 * already isolated the genuinely-affected tasks (see engine `buildDiff`), so
 * this just pairs each changed task's pre-change position (from `before`) with
 * its committed position and classifies why it moved.
 */
export function summarizeCascadeMoves(
  before: ScheduleContext,
  diff: DiffShiftResult,
  targetLineId: string,
): CascadeMove[] {
  const beforeById = new Map(before.schedule.map((l) => [l.id, l]));
  const targetLine = beforeById.get(targetLineId);
  if (!targetLine) return [];

  const moves: CascadeMove[] = [];
  for (const afterLine of diff.changed) {
    const beforeLine = beforeById.get(afterLine.id);
    if (!beforeLine) continue;
    const reason: CascadeMove["reason"] =
      beforeLine.jobNo === targetLine.jobNo &&
      beforeLine.departmentId !== targetLine.departmentId
        ? "department-flow"
        : beforeLine.employeeId === targetLine.employeeId
          ? "employee-queue"
          : "other";
    moves.push({
      line: beforeLine,
      beforeStart: beforeLine.startDateTime,
      afterStart: afterLine.startDateTime,
      beforeEnd: beforeLine.endDateTime,
      afterEnd: afterLine.endDateTime,
      reason,
    });
  }
  return moves;
}

interface CascadeConfirmDialogProps {
  targetLine: ScheduleLine;
  newStart: Date;
  newEmployeeId?: string;
  newOverrideHours?: number;
  changeKind: "move" | "resize";
  moves: CascadeMove[];
  employeeName: (id: string) => string;
  departmentName: (id: string) => string;
  showScenarioOption: boolean;
  onCancel: () => void;
  onMoveOnly: () => void;
  onEnterScenario: () => void;
  onContinue: () => void;
}

export default function CascadeConfirmDialog({
  targetLine,
  newStart,
  newEmployeeId,
  newOverrideHours,
  changeKind,
  moves,
  employeeName,
  departmentName,
  showScenarioOption,
  onCancel,
  onMoveOnly,
  onEnterScenario,
  onContinue,
}: CascadeConfirmDialogProps) {
  // Escape cancels — gives keyboard users a fast exit from the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const deptFlow = moves.filter((m) => m.reason === "department-flow");
  const queueMoves = moves.filter((m) => m.reason === "employee-queue");
  const otherMoves = moves.filter((m) => m.reason === "other");

  const targetDept = departmentName(targetLine.departmentId);
  const targetEmp = employeeName(targetLine.employeeId);
  const summaryVerb = changeKind === "resize" ? "Resizing" : "Moving";

  return (
    <div
      className="slide-over"
      style={{ justifyContent: "center", alignItems: "center" }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Cascade preview — ${moves.length} downstream tasks would shift`}
        style={{
          background: "#fff",
          borderRadius: 8,
          width: 560,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚡</span>
          <span>
            {summaryVerb} this task will shift {moves.length} downstream{" "}
            {moves.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div style={{ padding: 14, overflowY: "auto", flex: 1 }}>
          <div
            style={{
              padding: 10,
              background: "var(--bg-secondary)",
              borderRadius: 4,
              border: "1px solid var(--border)",
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
              Target
            </div>
            <div style={{ fontWeight: 600 }}>
              {targetLine.jobNo} · {targetLine.customerName} · {targetLine.planningLineDescription}
            </div>
            <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
              {targetDept} · {targetEmp}
            </div>
            <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
              {changeKind === "resize" ? (
                <>
                  Hours: <strong>{targetLine.overrideHours ?? targetLine.estimatedHours}h</strong>{" "}
                  → <strong>{newOverrideHours}h</strong>
                </>
              ) : (
                <>
                  Start: <strong>{format(targetLine.startDateTime, "EEE MMM d HH:mm")}</strong>{" "}
                  → <strong>{format(newStart, "EEE MMM d HH:mm")}</strong>
                  {newEmployeeId && newEmployeeId !== targetLine.employeeId && (
                    <>
                      <br />
                      Resource: <strong>{targetEmp}</strong> →{" "}
                      <strong>{employeeName(newEmployeeId)}</strong>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {deptFlow.length > 0 && (
            <Section
              icon="↳"
              label="Department-flow cascade"
              hint="These tasks are downstream in the same job and would shift to keep the flow valid:"
              moves={deptFlow}
              employeeName={employeeName}
              departmentName={departmentName}
            />
          )}

          {queueMoves.length > 0 && (
            <Section
              icon="↓"
              label="Same-resource queue"
              hint="These tasks would push forward to avoid overlap on the same resource:"
              moves={queueMoves}
              employeeName={employeeName}
              departmentName={departmentName}
            />
          )}

          {otherMoves.length > 0 && (
            <Section
              icon="⤳"
              label="Knock-on effects"
              hint="Additional tasks pushed by the chain reaction:"
              moves={otherMoves}
              employeeName={employeeName}
              departmentName={departmentName}
            />
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: showScenarioOption ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr",
            gap: 8,
            background: "var(--bg-secondary)",
          }}
        >
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={onMoveOnly}
            title="Move only this task; downstream tasks keep their dates and may surface conflict icons"
          >
            Move only this
          </button>
          {showScenarioOption && (
            <button
              className="btn-secondary"
              onClick={onEnterScenario}
              title="Snapshot the schedule, stage this change in the Scenario Sandbox so you can review the cascade before applying"
            >
              Try in Sandbox
            </button>
          )}
          <button className="btn-primary" onClick={onContinue}>
            Continue with cascade
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  hint,
  moves,
  employeeName,
  departmentName,
}: {
  icon: string;
  label: string;
  hint: string;
  moves: CascadeMove[];
  employeeName: (id: string) => string;
  departmentName: (id: string) => string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--text-secondary)",
          marginBottom: 2,
        }}
      >
        {icon} {label}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
        {hint}
      </div>
      {moves.map((m) => {
        const startDelta = Math.round(
          (m.afterStart.getTime() - m.beforeStart.getTime()) / (1000 * 60 * 60),
        );
        return (
          <div
            key={m.line.id}
            style={{
              padding: "6px 8px",
              marginBottom: 4,
              background: "#fff",
              borderRadius: 4,
              border: "1px solid var(--border)",
              fontSize: 11,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {m.line.jobNo} · {m.line.planningLineDescription}
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              {departmentName(m.line.departmentId)} · {employeeName(m.line.employeeId)}
            </div>
            <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
              {format(m.beforeStart, "EEE MMM d HH:mm")}
              {" → "}
              <strong>{format(m.afterStart, "EEE MMM d HH:mm")}</strong>{" "}
              <span
                style={{
                  color: startDelta >= 0 ? "var(--lumineo-red)" : "#1b6e3e",
                  fontSize: 10,
                }}
              >
                ({startDelta >= 0 ? `+${startDelta}h` : `${startDelta}h`})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
