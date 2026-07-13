import { useEffect, useMemo, useState } from "react";
import { format, startOfDay } from "date-fns";
import { fetchActiveJobs, type ActiveJob } from "../services/dataverse-live";
import {
  PROJECT_MANAGERS,
  SALESPEOPLE,
  personByCode,
  salespeopleForPm,
  type SalesPmPerson,
} from "../services/sales-pm";

const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

/** All currently-scheduled jobs (fetched once when the screen opens). */
function useActiveJobs(): { jobs: ActiveJob[]; loading: boolean } {
  const [state, setState] = useState<{ jobs: ActiveJob[]; loading: boolean }>({
    jobs: [],
    loading: true,
  });
  useEffect(() => {
    if (!LIVE) {
      setState({ jobs: [], loading: false });
      return;
    }
    let alive = true;
    fetchActiveJobs(startOfDay(new Date()))
      .then((jobs) => alive && setState({ jobs, loading: false }))
      .catch(() => alive && setState({ jobs: [], loading: false }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** A list of active jobs, nearest-first, each tagged with where it's scheduled. */
function ActiveJobsList({
  jobs,
  loading,
  showSalesperson,
  emptyLabel,
}: {
  jobs: ActiveJob[];
  loading: boolean;
  showSalesperson?: boolean;
  emptyLabel?: string;
}) {
  if (loading) return <div className="loading">Loading jobs…</div>;
  if (jobs.length === 0)
    return <div className="active-jobs__empty">{emptyLabel ?? "No scheduled jobs right now."}</div>;
  return (
    <div className="active-jobs__list">
      {jobs.map((j) => (
        <div key={j.jobNo} className="active-job">
          <div className="active-job__head">
            <span className="active-job__no">{j.jobNo}</span>
            <span className="active-job__cust">{j.customerName}</span>
            {showSalesperson && personByCode(j.salespersonCode) && (
              <span className="active-job__sales">{personByCode(j.salespersonCode)!.name}</span>
            )}
          </div>
          <div className="active-job__placements">
            {j.placements.map((p, i) => (
              <span key={i} className={`active-chip active-chip--${p.kind}`}>
                {p.label} · {format(p.date, "EEE MMM d")}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One salesperson's scheduled jobs. */
function SalespersonActiveJobs({
  code,
  jobs,
  loading,
  lead,
}: {
  code: string;
  jobs: ActiveJob[];
  loading: boolean;
  lead?: React.ReactNode;
}) {
  const person = personByCode(code);
  const mine = useMemo(() => jobs.filter((j) => j.salespersonCode === code), [jobs, code]);
  return (
    <div className="active-jobs">
      {lead}
      <div className="active-jobs__head">
        <div className="active-jobs__who">{person?.name ?? code}</div>
        <div className="active-jobs__sub">
          {mine.length} active job{mine.length === 1 ? "" : "s"}
        </div>
      </div>
      <ActiveJobsList jobs={mine} loading={loading} emptyLabel="No scheduled jobs right now." />
    </div>
  );
}

/** A PM's jobs: an "All jobs" tab plus one tab per salesperson they manage. */
function PmActiveJobs({
  pmCode,
  jobs,
  loading,
  lead,
}: {
  pmCode: string;
  jobs: ActiveJob[];
  loading: boolean;
  lead?: React.ReactNode;
}) {
  const pm = personByCode(pmCode);
  const managed = useMemo(() => salespeopleForPm(pmCode), [pmCode]);
  const managedCodes = useMemo(() => new Set(managed.map((m) => m.code)), [managed]);
  // Tab: "all" or a specific salesperson code.
  const [tab, setTab] = useState<string>("all");
  const shown = useMemo(
    () => jobs.filter((j) => (tab === "all" ? managedCodes.has(j.salespersonCode ?? "") : j.salespersonCode === tab)),
    [jobs, tab, managedCodes],
  );
  return (
    <div className="active-jobs">
      {lead}
      <div className="active-jobs__head">
        <div className="active-jobs__who">{pm?.name ?? pmCode}</div>
        <div className="active-jobs__sub">Project Manager</div>
      </div>
      <div className="emp-browser__tabs" role="tablist" aria-label="Salespeople">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={`emp-browser__tab${tab === "all" ? " emp-browser__tab--active" : ""}`}
          onClick={() => setTab("all")}
        >
          All jobs
        </button>
        {managed.map((m) => (
          <button
            key={m.code}
            type="button"
            role="tab"
            aria-selected={tab === m.code}
            className={`emp-browser__tab${tab === m.code ? " emp-browser__tab--active" : ""}`}
            onClick={() => setTab(m.code)}
          >
            {m.name}
          </button>
        ))}
      </div>
      <ActiveJobsList jobs={shown} loading={loading} showSalesperson={tab === "all"} />
    </div>
  );
}

/** Admin/ops: browse every salesperson and PM, then open their jobs. */
export function SalesPmBrowser() {
  const { jobs, loading } = useActiveJobs();
  const [picked, setPicked] = useState<SalesPmPerson | null>(null);

  if (picked) {
    const lead = (
      <button type="button" className="my-schedule__switch" onClick={() => setPicked(null)}>
        ← All Sales / PM
      </button>
    );
    return picked.type === "pm" ? (
      <PmActiveJobs pmCode={picked.code} jobs={jobs} loading={loading} lead={lead} />
    ) : (
      <SalespersonActiveJobs code={picked.code} jobs={jobs} loading={loading} lead={lead} />
    );
  }

  return (
    <div className="salespm-roster">
      <div className="salespm-roster__group">Salespeople</div>
      <div className="emp-picker__list">
        {SALESPEOPLE.map((p) => (
          <button key={p.code} type="button" className="emp-picker__item" onClick={() => setPicked(p)}>
            <span>{p.name}</span>
            {p.pmCode && <span className="emp-picker__truck">PM · {personByCode(p.pmCode)?.name}</span>}
          </button>
        ))}
      </div>
      <div className="salespm-roster__divider" />
      <div className="salespm-roster__group">Project Managers</div>
      <div className="emp-picker__list">
        {PROJECT_MANAGERS.map((p) => (
          <button key={p.code} type="button" className="emp-picker__item" onClick={() => setPicked(p)}>
            <span>{p.name}</span>
            <span className="emp-picker__truck">{salespeopleForPm(p.code).length} salespeople</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A Sales/PM person's own "My Active Jobs" (driven by their login). */
export function PersonalActiveJobs({ code, type }: { code: string; type: "sales" | "pm" }) {
  const { jobs, loading } = useActiveJobs();
  return type === "pm" ? (
    <PmActiveJobs pmCode={code} jobs={jobs} loading={loading} />
  ) : (
    <SalespersonActiveJobs code={code} jobs={jobs} loading={loading} />
  );
}
