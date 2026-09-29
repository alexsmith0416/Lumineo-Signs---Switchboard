import { useEffect, useMemo, useState } from "react";
import { useJobTrackingStore } from "../../store/job-tracking-store";
import { useJobScheduleStore } from "../../store/job-schedule-store";
import { buildJobRows, type JobRow, type JobScheduleDates } from "../../services/job-tracking";
import JobsGrid from "./JobsGrid";
import JobsJobPanel from "./JobsJobPanel";
import { FilterPanel, GroupPanel, SortPanel } from "./JobsPanels";
import { ALL_JOB_VIEWS, JOB_FIELDS, JOB_VIEW_GROUPS, type JobsView as JobsViewDef } from "./jobs-fields";
import { applyGrid, type GridPrefs } from "./jobs-grid-state";

/**
 * Jobs — every open BC job with its tracking fields and stepper (Phase 1,
 * read-only). Replaces the Airtable "LNI Production Schedule / Expeditor" list.
 * Each view keeps its own sorts / filters / groups on this device.
 */
const PREFS_KEY = (view: string) => `lumineo.jobs.view.${view}`;
const LAST_VIEW_KEY = "lumineo.jobs.lastView";

function loadPrefs(view: JobsViewDef): GridPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY(view.name));
    if (raw) return JSON.parse(raw) as GridPrefs;
  } catch {
    /* private window / blocked storage — fall through to defaults */
  }
  return { sorts: [], filters: [], groups: view.defaultGroup ? [{ field: view.defaultGroup, asc: true }] : [] };
}

function savePrefs(view: string, prefs: GridPrefs) {
  try {
    localStorage.setItem(PREFS_KEY(view), JSON.stringify(prefs));
  } catch {
    /* non-critical */
  }
}

type Panel = "filter" | "sort" | "group" | null;

const ymd = (d: Date | null | undefined): string =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";

export default function JobsView({ canSeeMoney, canEdit }: { canSeeMoney: boolean; canEdit: boolean }) {
  const bcJobs = useJobTrackingStore((s) => s.bcJobs);
  const tracks = useJobTrackingStore((s) => s.tracks);
  const loading = useJobTrackingStore((s) => s.loading);
  const loaded = useJobTrackingStore((s) => s.loaded);
  const error = useJobTrackingStore((s) => s.error);
  const load = useJobTrackingStore((s) => s.load);
  // Dates come from the SAME job-schedule store the boards' Install Dates use,
  // so an edit anywhere shows here at once (and here → the boards).
  const scheduleByJob = useJobScheduleStore((s) => s.byJob);
  const loadSchedules = useJobScheduleStore((s) => s.load);
  useEffect(() => {
    void load();
    void loadSchedules();
  }, [load, loadSchedules]);

  const rows = useMemo(() => {
    const dates = new Map<string, JobScheduleDates>();
    for (const [jobNo, sch] of Object.entries(scheduleByJob)) {
      dates.set(jobNo, {
        redDate: ymd(sch.redDate),
        productionCompleteDate: ymd(sch.productionCompleteDate),
        releasedDate: ymd(sch.releasedDate),
        scheduledInstallDate: ymd(sch.scheduledInstallDate),
      });
    }
    return buildJobRows(bcJobs, tracks, dates, new Date());
  }, [bcJobs, tracks, scheduleByJob]);
  const [openJob, setOpenJob] = useState<JobRow | null>(null);

  const [viewName, setViewName] = useState<string>(() => {
    try {
      const v = localStorage.getItem(LAST_VIEW_KEY);
      if (v && ALL_JOB_VIEWS.some((x) => x.name === v)) return v;
    } catch {
      /* ignore */
    }
    return ALL_JOB_VIEWS[0]!.name;
  });
  const view = ALL_JOB_VIEWS.find((v) => v.name === viewName) ?? ALL_JOB_VIEWS[0]!;
  const [prefs, setPrefsState] = useState<GridPrefs>(() => loadPrefs(view));
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [collapseSignal, setCollapseSignal] = useState({ n: 0, all: false });

  const pickView = (name: string) => {
    const v = ALL_JOB_VIEWS.find((x) => x.name === name)!;
    setViewName(name);
    setPrefsState(loadPrefs(v));
    setPanel(null);
    try {
      localStorage.setItem(LAST_VIEW_KEY, name);
    } catch {
      /* ignore */
    }
  };
  const setPrefs = (patch: Partial<GridPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefsState(next);
    savePrefs(view.name, next);
  };

  const cols = useMemo(
    () => view.cols.map((k) => JOB_FIELDS[k]).filter((d): d is NonNullable<typeof d> => !!d && (!d.money || canSeeMoney)),
    [view, canSeeMoney],
  );
  const allFields = useMemo(
    () => Object.values(JOB_FIELDS).filter((d) => !d.money || canSeeMoney),
    [canSeeMoney],
  );
  const inView = useMemo(() => (view.include ? rows.filter(view.include) : rows), [rows, view]);
  const shown = useMemo(() => applyGrid(inView, search, prefs), [inView, search, prefs]);

  const toggleSort = (field: string) => {
    const cur = prefs.sorts.find((s) => s.field === field);
    setPrefs({ sorts: !cur ? [{ field, asc: true }] : cur.asc ? [{ field, asc: false }] : [] });
  };

  const counts = { filter: prefs.filters.length, sort: prefs.sorts.length, group: prefs.groups.length };

  return (
    <div className="jobs-view" onClick={() => setPanel(null)}>
      <nav className="jobs-views" aria-label="Job views">
        {JOB_VIEW_GROUPS.map((g) => (
          <div key={g.label} className="jobs-views__group">
            <div className="jobs-views__label">{g.label}</div>
            {g.views.map((v) => (
              <button
                key={v.name}
                type="button"
                className={`jobs-views__item${v.name === view.name ? " jobs-views__item--active" : ""}`}
                onClick={() => pickView(v.name)}
              >
                {v.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <section className="jobs-main">
        <div className="jobs-toolbar">
          <input
            className="jobs-toolbar__search"
            type="search"
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {(["filter", "sort", "group"] as const).map((p) => (
            <div key={p} className="jobs-toolbar__btn-wrap" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`jobs-toolbar__btn${counts[p] ? " jobs-toolbar__btn--on" : ""}`}
                onClick={() => setPanel(panel === p ? null : p)}
              >
                {p === "filter" ? "Filter" : p === "sort" ? "Sort" : "Group"}
                {counts[p] > 0 && <span className="jobs-toolbar__count">{counts[p]}</span>}
              </button>
              {panel === "filter" && p === "filter" && (
                <FilterPanel fields={allFields} filters={prefs.filters} rows={inView}
                  onChange={(filters) => setPrefs({ filters })} onClose={() => setPanel(null)} />
              )}
              {panel === "sort" && p === "sort" && (
                <SortPanel fields={allFields} sorts={prefs.sorts} onChange={(sorts) => setPrefs({ sorts })} onClose={() => setPanel(null)} />
              )}
              {panel === "group" && p === "group" && (
                <GroupPanel fields={allFields} groups={prefs.groups} onChange={(groups) => setPrefs({ groups })}
                  onClose={() => setPanel(null)}
                  onCollapseAll={() => setCollapseSignal((s) => ({ n: s.n + 1, all: true }))}
                  onExpandAll={() => setCollapseSignal((s) => ({ n: s.n + 1, all: false }))} />
              )}
            </div>
          ))}
          <span className="jobs-toolbar__meta">
            {loading && !loaded ? "Loading jobs…" : `${shown.length.toLocaleString()} of ${inView.length.toLocaleString()} jobs`}
          </span>
          <span className="jobs-toolbar__spring" />
          <span className="jobs-toolbar__note">Click a job to open it</span>
          <button type="button" className="jobs-toolbar__btn" onClick={() => { void load(true); void loadSchedules(true); }} disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <div className="jobs-error">Couldn't load jobs: {error}</div>}
        <JobsGrid rows={shown} cols={cols} groups={prefs.groups} sorts={prefs.sorts} onToggleSort={toggleSort}
          collapseSignal={collapseSignal} onOpen={setOpenJob} />
      </section>
      {openJob && (
        <JobsJobPanel
          row={rows.find((r) => r.jobNo === openJob.jobNo) ?? openJob}
          canEdit={canEdit}
          onClose={() => setOpenJob(null)}
        />
      )}
    </div>
  );
}
