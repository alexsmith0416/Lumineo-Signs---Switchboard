import type { Conflict, Department, ScheduleLine } from "../engine/types";

interface JobCardProps {
  line: ScheduleLine;
  department: Department | undefined;
  conflicts: Conflict[];
}

function deptStyle(dept: Department | undefined): { bg: string; text: string } {
  if (!dept) return { bg: "#cccccc", text: "#222222" };
  const bg = dept.color;
  const textMap: Record<string, string> = {
    "#BED7FF": "#042c53",
    "#FAC775": "#633806",
    "#CECBF6": "#26215c",
    "#C8E6D4": "#04342c",
    "#FFE0A8": "#5e3c00",
  };
  return { bg, text: textMap[bg] ?? "#1a1d23" };
}

export default function JobCard({ line, department, conflicts }: JobCardProps) {
  const style = deptStyle(department);
  const lineConflicts = conflicts.filter((c) => c.lineId === line.id);
  const pastDue = lineConflicts.some((c) => c.type === "past-due");
  const overlap = lineConflicts.some((c) => c.type === "employee-overlap" || c.type === "department-order");

  return (
    <div
      className="job-card"
      style={{ background: style.bg, color: style.text }}
      title={`${line.jobNo} — ${line.customerName}\n${line.planningLineDescription}`}
    >
      <div className="job-card__job-no">{line.jobNo}</div>
      <div className="job-card__customer">{line.customerName}</div>
      <div className="job-card__desc">{line.planningLineDescription}</div>
      <div className="job-card__icons">
        {line.isLocked && <span title="Locked">🔒</span>}
        {pastDue && <span title="Past customer due date">⚠</span>}
        {overlap && <span title="Conflict">⚡</span>}
      </div>
    </div>
  );
}
