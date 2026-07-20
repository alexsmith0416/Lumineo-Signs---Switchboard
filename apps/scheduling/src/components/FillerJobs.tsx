import type { Department } from "../engine/types";
import type { UseJobQueueStore } from "../store/job-queue-store";
import { useJobSearch, type JobSearchResult } from "../hooks/useJobSearch";
import { newId, type QueueItem } from "../services/job-queue-data";

/** The filler QueueItems for a department (items in the board's "Fill-in Jobs"
 *  group scoped to that department). */
export function fillerItemsForDept(
  groups: { name: string; items: QueueItem[] }[],
  deptId: string,
): QueueItem[] {
  const g = groups.find((x) => /fill.?in/i.test(x.name));
  return (g?.items ?? []).filter((it) => it.departmentId === deptId);
}

/**
 * Bottom-of-department "Fill-in Jobs" card — a holding list of BC jobs a
 * department can pick up as filler between/after scheduled work. Shows the count,
 * lists the jobs on hover, and opens the full list on click.
 */
export function DepartmentFillerRow({
  items,
  onOpen,
}: {
  items: QueueItem[];
  onOpen: () => void;
}) {
  const hoverList = items.length
    ? items.map((j) => `${j.jobNo} · ${j.customerName}`).join("\n")
    : "No filler jobs yet — right-click the department banner to add.";
  return (
    <div className="filler-row">
      <div className="filler-row__name">Fill-in Jobs</div>
      <div className="filler-row__strip">
        <button type="button" className="filler-card" onClick={onOpen} title={hoverList}>
          <span className="filler-card__label">Fill-in Jobs</span>
          <span className="filler-card__count">
            {items.length} job{items.length === 1 ? "" : "s"}
          </span>
          <span className="filler-card__hint">click to view</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Slide-over listing a department's filler jobs (like the Job Queue), with a BC
 * job search to add and per-row remove.
 */
export function FillerJobsPanel({
  dept,
  useQueueStore,
  onClose,
}: {
  dept: Department;
  useQueueStore: UseJobQueueStore;
  onClose: () => void;
}) {
  const groups = useQueueStore((s) => s.groups);
  const ensureFillInGroup = useQueueStore((s) => s.ensureFillInGroup);
  const addItem = useQueueStore((s) => s.addItem);
  const removeItem = useQueueStore((s) => s.removeItem);
  const { query, setQuery, results, loading } = useJobSearch();

  const fillGroup = groups.find((g) => /fill.?in/i.test(g.name));
  const items = (fillGroup?.items ?? []).filter((it) => it.departmentId === dept.id);
  const already = new Set(items.map((it) => it.jobNo));

  const add = (r: JobSearchResult) => {
    const groupId = ensureFillInGroup();
    const hours = r.mappedLines.reduce((s, l) => s + l.estimatedHours, 0);
    const item: QueueItem = {
      id: newId(),
      groupId,
      jobNo: r.job.jobNo,
      customerName: r.job.customerName,
      jobDescription: "",
      planningLineDescription: r.mappedLines.map((l) => l.description).join("\n"),
      estimatedHours: hours,
      departmentId: dept.id,
      crewPersons: null,
      crewTrucks: null,
      crewTrips: null,
      installZip: null,
      invoiceAmount: null,
      isCustom: false,
      customColor: null,
      customTextColor: null,
      sortOrder: fillGroup?.items.length ?? 0,
    };
    addItem(item);
    setQuery("");
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">
          Fill-in Jobs · {dept.name}
          <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            {items.length} job{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="slide-over__body">
          <div className="filler-list">
            {items.length === 0 ? (
              <div className="jtp__note">No filler jobs yet. Search below to add.</div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="filler-list__item">
                  <div className="filler-list__main">
                    <span className="filler-list__no">{it.jobNo}</span>
                    <span className="filler-list__cust">{it.customerName}</span>
                    {it.planningLineDescription && (
                      <span className="filler-list__desc">{it.planningLineDescription}</span>
                    )}
                  </div>
                  <div className="filler-list__side">
                    {it.estimatedHours > 0 && <span className="filler-list__hours">{it.estimatedHours}h</span>}
                    <button
                      type="button"
                      className="filler-list__remove"
                      title="Remove from filler list"
                      onClick={() => removeItem(it.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="filler-add">
            <div className="form-field__label" style={{ background: "none", padding: "10px 12px 4px" }}>
              Add a BC job
            </div>
            <div style={{ padding: "0 12px 8px" }}>
              <input
                className="form-field__input"
                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search job number or customer…"
              />
            </div>
            {loading && <div className="jtp__note">Searching…</div>}
            {!loading && query.trim() && results.length === 0 && (
              <div className="jtp__note">No matching BC jobs.</div>
            )}
            <div className="filler-results">
              {results.map((r) => (
                <button
                  key={r.job.jobNo}
                  type="button"
                  className="filler-results__row"
                  disabled={already.has(r.job.jobNo)}
                  onClick={() => add(r)}
                >
                  <span className="filler-list__no">{r.job.jobNo}</span>
                  <span className="filler-list__cust">{r.job.customerName}</span>
                  <span className="filler-results__add">{already.has(r.job.jobNo) ? "added" : "+ add"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
