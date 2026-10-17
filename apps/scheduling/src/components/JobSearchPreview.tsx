import { format } from "date-fns";
import type { Department } from "../engine/types";
import type { JobSearchResult } from "../hooks/useJobSearch";
import { useJobSteps } from "../hooks/useJobSteps";
import { useJobRow } from "../hooks/useJobRows";
import DepartmentStepper from "./DepartmentStepper";
import { MaterialsReadyChip } from "./MaterialsReadyChip";

const TASKS_SHOWN = 8;

function shortDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? "" : format(d, "MMM d");
}

/**
 * A BC job's details while picking it in the Add Job panel: description, due
 * date, Jobs-list status / priority / red date, its stepper (which departments
 * are open / done), and — in the hover preview — its BC tasks with hours.
 */
export function JobSearchDetails({
  result,
  departments,
  showTasks,
}: {
  result: JobSearchResult;
  departments: ReadonlyMap<string, Department>;
  showTasks: boolean;
}) {
  const { job, mappedLines } = result;
  const row = useJobRow(job.jobNo);
  const { steps, serviceSteps } = useJobSteps(job.jobNo);
  const due = shortDate(job.promisedDate);
  const red = shortDate(row?.redDate);
  const totalHours = mappedLines.reduce((n, l) => n + (l.estimatedHours || 0), 0);
  const meta = [
    row?.status && `Status: ${row.status}`,
    row?.priority && `Priority: ${row.priority}`,
    due && `Due ${due}`,
    red && `Red date ${red}`,
  ].filter(Boolean);

  return (
    <div className="job-search-details">
      {job.description && <div className="job-search-details__desc">{job.description}</div>}
      {meta.length > 0 && <div className="job-search-details__meta">{meta.join(" · ")}</div>}
      <MaterialsReadyChip jobNo={job.jobNo} style={{ marginTop: 4 }} />
      {steps.length > 0 && (
        <div className="job-search-details__stepper">
          <DepartmentStepper steps={steps} size="sm" />
        </div>
      )}
      {serviceSteps.length > 0 && (
        <div className="job-search-details__stepper">
          <DepartmentStepper steps={serviceSteps} size="sm" />
        </div>
      )}
      {showTasks && (
        <div className="job-search-details__tasks">
          <div className="job-search-details__tasks-head">
            {mappedLines.length} task{mappedLines.length === 1 ? "" : "s"}
            {totalHours > 0 ? ` · ${Math.round(totalHours * 10) / 10} h` : ""}
          </div>
          {mappedLines.length === 0 && <div className="job-search-details__none">No BC planning lines.</div>}
          {mappedLines.slice(0, TASKS_SHOWN).map((l) => (
            <div key={l.lineNo} className="job-search-details__task">
              <span className="job-search-details__task-text">{l.description.split("\n")[0]}</span>
              <span className="job-search-details__task-side">
                {l.departmentId ? departments.get(l.departmentId)?.name ?? "" : ""}
                {l.estimatedHours ? ` · ${l.estimatedHours} h` : ""}
              </span>
            </div>
          ))}
          {mappedLines.length > TASKS_SHOWN && (
            <div className="job-search-details__none">+{mappedLines.length - TASKS_SHOWN} more — click the job to see them all</div>
          )}
        </div>
      )}
    </div>
  );
}

/** The hover preview beside a search result (not interactive — it follows the pointer's row). */
export default function JobSearchPreview({
  result,
  rect,
  departments,
}: {
  result: JobSearchResult;
  rect: DOMRect;
  departments: ReadonlyMap<string, Department>;
}) {
  const W = 320;
  // Beside the result — left of it when there's room (the panel sits on the right).
  const left = rect.left - W - 10 >= 8 ? rect.left - W - 10 : Math.min(rect.right + 10, window.innerWidth - W - 8);
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - 360));
  return (
    <div className="job-search-preview" style={{ left, top, width: W }} role="tooltip">
      <div className="job-search-preview__head">
        <strong>{result.job.jobNo}</strong> {result.job.customerName}
      </div>
      <JobSearchDetails result={result} departments={departments} showTasks />
    </div>
  );
}
