import { useMemo, useState } from "react";
import { useJobSearch } from "../../../hooks/useJobSearch";
import { useScenarioStore } from "../../../store/scenario-store";
import { useScheduleStore } from "../../../store/schedule-store";

export default function RushJobForm({ onDone }: { onDone: () => void }) {
  const { query, setQuery, results } = useJobSearch();
  const addChange = useScenarioStore((s) => s.addChange);
  const employees = useScheduleStore((s) => s.employees);
  const departments = useScheduleStore((s) => s.departments);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [earliestStart, setEarliestStart] = useState("");

  const selected = useMemo(
    () => (selectedIdx !== null ? results[selectedIdx] : null),
    [results, selectedIdx],
  );

  const firstEmployeeForDept = (deptId: string | null) => {
    if (!deptId) return null;
    for (const e of employees.values()) {
      if (e.departmentId === deptId) return e.id;
    }
    return null;
  };

  return (
    <div>
      <div className="section-title">Insert Rush Job</div>
      <div style={{ padding: 12 }}>
        <input
          className="form-field__input"
          style={{ width: "100%" }}
          placeholder="Search BC job…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIdx(null);
          }}
        />
        {!selected && results.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0" }}>
            {results.map((r, i) => (
              <li key={r.job.jobNo} style={{ marginBottom: 4 }}>
                <button
                  className="btn-secondary"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => {
                    setSelectedIdx(i);
                    setDueDate(r.job.promisedDate);
                  }}
                >
                  {r.job.jobNo} · {r.job.customerName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <>
          <div className="form-field">
            <div className="form-field__label">Due date</div>
            <input
              className="form-field__input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <div className="form-field__label">Earliest start</div>
            <input
              className="form-field__input"
              type="datetime-local"
              value={earliestStart}
              onChange={(e) => setEarliestStart(e.target.value)}
            />
          </div>
          <div style={{ padding: 12, fontSize: 11, color: "var(--text-secondary)" }}>
            {selected.mappedLines.length} planning line(s) — auto-assigned to first available
            employee per department.
          </div>
          <div style={{ padding: 12 }}>
            <button
              className="btn-primary"
              disabled={!dueDate || !earliestStart}
              onClick={() => {
                addChange({
                  type: "insert-rush-job",
                  jobNo: selected.job.jobNo,
                  customerName: selected.job.customerName,
                  customerDueDate: new Date(dueDate),
                  earliestStart: new Date(earliestStart),
                  tasks: selected.mappedLines
                    .filter((l) => l.departmentId)
                    .map((l) => ({
                      planningLineDescription: l.description,
                      estimatedHours: l.estimatedHours,
                      departmentId: l.departmentId!,
                      employeeId: firstEmployeeForDept(l.departmentId) ?? "",
                    }))
                    .filter((t) => t.employeeId),
                });
                onDone();
              }}
            >
              Add to scenario
            </button>
          </div>
        </>
      )}
      {departments.size === 0 && (
        <div style={{ padding: 12, color: "var(--text-tertiary)", fontSize: 11 }}>
          Load schedule first.
        </div>
      )}
    </div>
  );
}
