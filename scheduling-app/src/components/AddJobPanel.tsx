import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useJobSearch, type JobSearchResult } from "../hooks/useJobSearch";
import { useScheduleStore } from "../store/schedule-store";
import { proposeSchedule, type ProposedSlot } from "../services/auto-schedule";
import type { ScheduleLine } from "../engine/types";

interface AddJobPanelProps {
  onClose: () => void;
  initialStart?: Date;
  initialEmployeeId?: string;
}

type Mode = "single" | "multi" | "auto";

export default function AddJobPanel({ onClose, initialStart, initialEmployeeId }: AddJobPanelProps) {
  const { query, setQuery, results, loading } = useJobSearch();
  const [selected, setSelected] = useState<JobSearchResult | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [checkedLines, setCheckedLines] = useState<Set<number>>(new Set());
  const [singleLineNo, setSingleLineNo] = useState<number | null>(null);
  const [proposed, setProposed] = useState<ProposedSlot[] | null>(null);

  const employees = useScheduleStore((s) => s.employees);
  const departments = useScheduleStore((s) => s.departments);
  const getContext = useScheduleStore((s) => s.getContext);
  const addScheduleLine = useScheduleStore((s) => s.addScheduleLine);

  const employeesByDept = useMemo(() => {
    const out = new Map<string, typeof employees extends Map<string, infer V> ? V[] : never>();
    for (const e of employees.values()) {
      const list = out.get(e.departmentId) ?? [];
      list.push(e);
      out.set(e.departmentId, list);
    }
    return out;
  }, [employees]);

  const runAutoSchedule = () => {
    if (!selected) return;
    const ctx = getContext();
    const slots = proposeSchedule(
      {
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        promisedDate: new Date(selected.job.promisedDate),
      },
      selected.mappedLines,
      ctx,
      { earliestStart: initialStart },
    );
    setProposed(slots);
  };

  const commit = async () => {
    if (!selected) return;
    const ctx = getContext();
    const targets =
      mode === "single"
        ? selected.mappedLines.filter((l) => l.lineNo === singleLineNo)
        : mode === "multi"
          ? selected.mappedLines.filter((l) => checkedLines.has(l.lineNo))
          : selected.mappedLines;

    const slotsToUse =
      mode === "auto" && proposed
        ? proposed
        : proposeSchedule(
            {
              jobNo: selected.job.jobNo,
              customerName: selected.job.customerName,
              promisedDate: new Date(selected.job.promisedDate),
            },
            targets,
            ctx,
            { earliestStart: initialStart },
          );

    for (const slot of slotsToUse) {
      if (!slot.employeeId || !slot.departmentId) continue;
      const newLine: ScheduleLine = {
        id: `line-${selected.job.jobNo}-${slot.lineNo}-${Date.now()}`,
        jobNo: selected.job.jobNo,
        customerName: selected.job.customerName,
        planningLineDescription: slot.description,
        startDateTime: slot.start,
        endDateTime: slot.end,
        estimatedHours: slot.estimatedHours,
        overrideHours: null,
        employeeId: initialEmployeeId && mode !== "auto" ? initialEmployeeId : slot.employeeId,
        departmentId: slot.departmentId,
        customerDueDate: new Date(selected.job.promisedDate),
        isLocked: false,
        jobSequence: slot.lineNo,
      };
      await addScheduleLine(newLine);
    }
    onClose();
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Add Job</div>

        <div style={{ padding: 12 }}>
          <input
            className="form-field__input"
            style={{ width: "100%", borderRadius: 4 }}
            placeholder="Search BC job number (e.g. J103101 or 103101)…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setProposed(null);
            }}
            autoFocus
          />
          {loading && <div className="loading">Searching…</div>}
          {!selected && results.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
              {results.map((r) => (
                <li key={r.job.jobNo} style={{ marginBottom: 4 }}>
                  <button
                    className="btn-secondary"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setSelected(r)}
                  >
                    <strong>{r.job.jobNo}</strong> — {r.job.customerName} · due {format(new Date(r.job.promisedDate), "MMM d")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <>
            <div className="section-title">{selected.job.jobNo} · {selected.job.customerName}</div>
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button
                  className={mode === "single" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("single")}
                >
                  Single
                </button>
                <button
                  className={mode === "multi" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => setMode("multi")}
                >
                  Multi
                </button>
                <button
                  className={mode === "auto" ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setMode("auto");
                    runAutoSchedule();
                  }}
                >
                  Auto-schedule
                </button>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {selected.mappedLines.map((line) => {
                  const dept = line.departmentId ? departments.get(line.departmentId) : undefined;
                  const proposedSlot = proposed?.find((p) => p.lineNo === line.lineNo);
                  const isCurrent =
                    mode === "single"
                      ? singleLineNo === line.lineNo
                      : mode === "multi"
                        ? checkedLines.has(line.lineNo)
                        : true;
                  return (
                    <li
                      key={line.lineNo}
                      style={{
                        padding: 8,
                        borderRadius: 4,
                        marginBottom: 6,
                        background: isCurrent ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                        cursor: mode === "auto" ? "default" : "pointer",
                      }}
                      onClick={() => {
                        if (mode === "single") setSingleLineNo(line.lineNo);
                        else if (mode === "multi") {
                          const next = new Set(checkedLines);
                          if (next.has(line.lineNo)) next.delete(line.lineNo);
                          else next.add(line.lineNo);
                          setCheckedLines(next);
                        }
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>
                        {line.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {line.estimatedHours}h · {dept?.name ?? "unmapped"}
                      </div>
                      {proposedSlot && proposedSlot.employeeId && (
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
                          → {employees.get(proposedSlot.employeeId)?.name ?? proposedSlot.employeeId} on{" "}
                          {format(proposedSlot.start, "EEE MMM d")} {format(proposedSlot.start, "HH:mm")}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={
              !selected ||
              (mode === "single" && singleLineNo === null) ||
              (mode === "multi" && checkedLines.size === 0)
            }
            onClick={commit}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
