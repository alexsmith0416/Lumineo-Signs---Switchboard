import { useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import PlannerMap, { STATE_COLORS, STATE_LABELS, type MapTrip } from "./PlannerMap";
import TripPanel, { type TripSource } from "./TripPanel";
import { TripTotals } from "./TripDays";
import { useTripStore } from "../../store/trip-store";
import type { SavedTrip, TripStop } from "../../services/saved-trips";
import WeatherChip from "../WeatherChip";
import { MUST_COLOR, MUST_THIS_WEEK, usePlannerJobs } from "../../hooks/usePlannerJobs";
import { useInstallQueueStoreNEK, useInstallQueueStoreWK } from "../../store/job-queue-store";
import { useJobGeoStore } from "../../store/job-geo-store";
import { googleMapsUrl } from "../../services/ship-to";
import { AVG_MPH, ROAD_FACTOR, type Region } from "../../services/geo";
import {
  DAY_HOURS,
  OVERNIGHT_ONE_WAY_HOURS,
  nearbyJobs,
  radiusGroups,
  type JobGroup,
  type MapState,
  type PlannerJob,
} from "../../services/install-planner";

type RegionPick = Region | "both";
type Tab = "groups" | "must" | "trips" | "job" | "trip";

const RADIUS_KEY = "lumineo.planner.radius";
const readRadius = (): number => {
  try {
    const n = Number(localStorage.getItem(RADIUS_KEY));
    return n >= 5 && n <= 150 ? n : 30;
  } catch {
    return 30;
  }
};
const hrs = (h: number) => (Math.round(h * 10) / 10).toString();
const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
/** The week to plan: this week, or next week once it's the weekend. */
const planningWeek = (d: Date) => mondayOf(d.getDay() === 0 || d.getDay() === 6 ? addDays(d, 2) : d);
const queueFor = (r: Region) => (r === "NEK" ? useInstallQueueStoreNEK : useInstallQueueStoreWK);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Install Planner — Stage 1 (Oct 11, 2026): every open install and service job
 * on a map, radius groups of ready jobs, "what fits near this job", and the
 * regions' "Must this week" lists. Admin / Ops. Drive figures are estimates
 * until Stage 2's road routes.
 */
/** A planner job as a trip stop (jobs without a map position can't be routed). */
const toStop = (j: PlannerJob): TripStop => ({
  jobNo: j.jobNo,
  name: j.name,
  address: j.address,
  zip: j.zip,
  kind: j.kind,
  hours: j.crewHours,
  lat: j.pos!.lat,
  lng: j.pos!.lng,
});

export default function InstallPlannerView({ canEdit, userName = "" }: { canEdit: boolean; userName?: string }) {
  const [weekStart, setWeekStart] = useState(() => planningWeek(new Date()));
  const { jobs, loading, error } = usePlannerJobs(weekStart);
  const [region, setRegion] = useState<RegionPick>("WK");
  const [showInstall, setShowInstall] = useState(true);
  const [showService, setShowService] = useState(true);
  const [showScheduled, setShowScheduled] = useState(true);
  const [showProduction, setShowProduction] = useState(false);
  const [radius, setRadiusState] = useState(readRadius);
  const [cross, setCross] = useState(false);
  const [tab, setTab] = useState<Tab>("groups");
  const [tripSource, setTripSource] = useState<TripSource | null>(null);
  const [mapTrip, setMapTrip] = useState<MapTrip | null>(null);
  const trips = useTripStore((s) => s.trips);
  useEffect(() => {
    void useTripStore.getState().load();
  }, []);
  const weekTrips = useMemo(
    () =>
      trips
        .filter((t) => t.weekStart === format(weekStart, "yyyy-MM-dd") && (region === "both" || t.region === region))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [trips, weekStart, region],
  );
  const openTrip = (src: TripSource) => {
    setTripSource(src);
    setTab("trip");
  };
  const closeTrip = () => {
    setTripSource(null);
    setMapTrip(null);
    setTab("groups");
  };
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const crossing = cross && region === "both";

  const setRadius = (n: number) => {
    setRadiusState(n);
    try {
      localStorage.setItem(RADIUS_KEY, String(n));
    } catch {
      /* per-device convenience only */
    }
  };

  const visible = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (region === "both" || j.region === region) &&
          (j.kind === "install" ? showInstall : showService) &&
          (j.state !== "scheduled" || showScheduled) &&
          (j.state !== "production" || showProduction),
      ),
    [jobs, region, showInstall, showService, showScheduled, showProduction],
  );
  const onMap = useMemo(() => visible.filter((j) => j.pos), [visible]);
  const unplaced = useMemo(() => visible.filter((j) => !j.pos), [visible]);
  const groups = useMemo(() => radiusGroups(visible, radius, crossing), [visible, radius, crossing]);
  const job = jobs.find((j) => j.jobNo === selectedJob) ?? null;
  const near = useMemo(() => (job ? nearbyJobs(job, visible, radius, crossing) : []), [job, visible, radius, crossing]);
  const counts = useMemo(() => {
    const c: Record<MapState, number> = { must: 0, locked: 0, ready: 0, scheduled: 0, production: 0 };
    for (const j of visible) c[j.state]++;
    return c;
  }, [visible]);

  const selectJob = (jobNo: string) => {
    setSelectedJob(jobNo);
    setTab("job");
  };
  const selectGroup = (id: string) => {
    setSelectedGroup((cur) => (cur === id ? null : id));
    setTab("groups");
  };

  return (
    <div className="pl">
      <div className="pl-toolbar">
        <div className="pl-week">
          <button type="button" className="btn-secondary" onClick={() => setWeekStart((w) => addWeeks(w, -1))} aria-label="Previous week">
            ‹
          </button>
          <span className="pl-week__label">Week of {format(weekStart, "MMM d")}</span>
          <button type="button" className="btn-secondary" onClick={() => setWeekStart((w) => addWeeks(w, 1))} aria-label="Next week">
            ›
          </button>
        </div>
        <Segmented
          value={region}
          options={[
            ["WK", "WK"],
            ["NEK", "NEK"],
            ["both", "Both"],
          ]}
          onChange={(v) => setRegion(v as RegionPick)}
          label="Region"
        />
        <Check label="Install" checked={showInstall} onChange={setShowInstall} />
        <Check label="Service" checked={showService} onChange={setShowService} />
        <Check label="Scheduled" checked={showScheduled} onChange={setShowScheduled} />
        <Check label="In production" checked={showProduction} onChange={setShowProduction} />
        <label className="pl-radius">
          <span>Radius</span>
          <input type="range" min={5} max={150} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          <b>{radius} mi</b>
        </label>
        {region === "both" && <Check label="Let regions share trips" checked={cross} onChange={setCross} />}
      </div>

      <GeoStatus approx={onMap.filter((j) => j.approx).length} total={onMap.length} />
      {error && <div className="pl-error">Couldn't load the install boards: {error}</div>}

      <div className="pl-body">
        <aside className="pl-panel">
          <div className="pl-tabs" role="tablist">
            <TabButton on={tab === "groups"} onClick={() => setTab("groups")}>
              Groups <span className="pl-count">{groups.length}</span>
            </TabButton>
            <TabButton on={tab === "must"} onClick={() => setTab("must")}>
              Must <span className="pl-count pl-count--must">{counts.must}</span>
            </TabButton>
            <TabButton on={tab === "trips"} onClick={() => setTab("trips")}>
              Trips <span className="pl-count">{weekTrips.length}</span>
            </TabButton>
            <TabButton on={tab === "job"} onClick={() => setTab("job")} disabled={!job}>
              {job ? job.jobNo : "Job"}
            </TabButton>
            {tripSource && (
              <TabButton on={tab === "trip"} onClick={() => setTab("trip")}>
                Trip
              </TabButton>
            )}
          </div>
          <div className="pl-panel__body">
            {loading ? (
              <div className="pl-empty">Loading jobs…</div>
            ) : tab === "trip" && tripSource ? (
              <TripPanel
                key={tripSource.kind === "saved" ? tripSource.trip.id : tripSource.label}
                source={tripSource}
                weekStart={weekStart}
                crossing={crossing}
                canEdit={canEdit}
                userName={userName}
                onMapTrip={setMapTrip}
                onClose={closeTrip}
              />
            ) : tab === "trips" ? (
              <SavedTripList trips={weekTrips} weekStart={weekStart} canEdit={canEdit} onOpen={(t) => openTrip({ kind: "saved", trip: t })} />
            ) : tab === "groups" ? (
              <GroupList
                groups={groups}
                radius={radius}
                weekStart={weekStart}
                selected={selectedGroup}
                onSelectGroup={selectGroup}
                onSelectJob={selectJob}
                onPlanTrip={(g) =>
                  openTrip({
                    kind: "group",
                    label: `Group ${g.id.slice(1)}`,
                    region: g.home.region,
                    home: g.home.name,
                    stops: g.jobs.filter((j) => j.pos).map(toStop),
                  })
                }
              />
            ) : tab === "must" ? (
              <MustList jobs={jobs} region={region} canEdit={canEdit} onSelectJob={selectJob} />
            ) : job ? (
              <JobDetail
                job={job}
                near={near}
                radius={radius}
                canEdit={canEdit}
                onSelectJob={selectJob}
                onPlanTrip={() =>
                  openTrip({
                    kind: "group",
                    label: `${job.jobNo} + nearby`,
                    region: job.region,
                    home: "",
                    stops: [job, ...near.map((n) => n.job)].filter((j) => j.pos).map(toStop),
                  })
                }
              />
            ) : null}
            {unplaced.length > 0 && tab === "groups" && (
              <details className="pl-unplaced">
                <summary>
                  {unplaced.length} job{unplaced.length === 1 ? "" : "s"} not on the map (no address or ZIP)
                </summary>
                <ul>
                  {unplaced.map((j) => (
                    <li key={j.jobNo}>
                      <button type="button" className="pl-link" onClick={() => selectJob(j.jobNo)}>
                        {j.jobNo}
                      </button>{" "}
                      {j.name}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </aside>

        <div className="pl-mapwrap">
          <PlannerMap
            jobs={onMap}
            groups={groups}
            radiusMi={radius}
            selectedJob={selectedJob}
            selectedGroup={selectedGroup}
            onSelectJob={selectJob}
            onSelectGroup={selectGroup}
            fitKey={`${region}|${showInstall}|${showService}|${loading}`}
            trip={tab === "trip" ? mapTrip : null}
          />
          <div className="pl-legend">
            {(Object.keys(STATE_COLORS) as MapState[])
              .filter((s) => s !== "production" || showProduction)
              .filter((s) => s !== "scheduled" || showScheduled)
              .map((s) => (
                <span key={s} className="pl-legend__item">
                  <span className="pl-pin pl-pin--legend" style={{ background: STATE_COLORS[s] }} />
                  {STATE_LABELS[s]} <b>{counts[s]}</b>
                </span>
              ))}
            <span className="pl-legend__item">
              <span className="pl-pin pl-pin--legend pl-pin--service" style={{ background: "#8A94A6" }} /> Service
            </span>
            <span className="pl-legend__item">
              <span className="pl-pin pl-pin--legend pl-pin--approx" style={{ background: "#8A94A6" }} /> Approximate (ZIP)
            </span>
          </div>
        </div>
      </div>
      <p className="pl-footnote">
        Drive times are estimates (straight line × {ROAD_FACTOR} at {AVG_MPH} mph) until road routes come in. A crew day is{" "}
        {DAY_HOURS} h including driving; over {OVERNIGHT_ONE_WAY_HOURS} h one-way makes a trip overnight.
      </p>
    </div>
  );
}

function GroupList({
  groups,
  radius,
  weekStart,
  selected,
  onSelectGroup,
  onSelectJob,
  onPlanTrip,
}: {
  groups: JobGroup[];
  radius: number;
  weekStart: Date;
  selected: string | null;
  onSelectGroup: (id: string) => void;
  onSelectJob: (jobNo: string) => void;
  onPlanTrip: (g: JobGroup) => void;
}) {
  if (!groups.length) return <div className="pl-empty">No ready or Must-this-week jobs to group.</div>;
  return (
    <ol className="pl-groups">
      {groups.map((g) => (
        <li key={g.id} className={`pl-group${g.id === selected ? " pl-group--on" : ""}`}>
          <button type="button" className="pl-group__head" onClick={() => onSelectGroup(g.id)} aria-expanded={g.id === selected}>
            <span className="pl-group__title">Group {g.id.slice(1)}</span>
            {g.mustCount > 0 && <span className="pl-badge pl-badge--must">{g.mustCount} must</span>}
            {g.overnight && <span className="pl-badge pl-badge--night">Overnight</span>}
            <span className="pl-group__region">{g.home.region}</span>
          </button>
          <div className="pl-group__stats">
            {g.jobs.length} job{g.jobs.length === 1 ? "" : "s"} · {hrs(g.crewHours)} crew h · from <b>{g.home.name}</b> · ~
            {hrs(g.oneWayHours)} h one-way · ≈ {g.estDays} crew-day{g.estDays === 1 ? "" : "s"}
          </div>
          <WeekWeather zip={g.jobs[0]?.zip ?? ""} weekStart={weekStart} />
          <button type="button" className="btn-secondary pl-plan" onClick={() => onPlanTrip(g)}>
            Plan trip →
          </button>
          {g.id === selected && (
            <ul className="pl-joblist">
              {g.jobs.map((j) => (
                <JobRowItem key={j.jobNo} job={j} onSelect={onSelectJob} />
              ))}
            </ul>
          )}
        </li>
      ))}
      <li className="pl-hint">Groups: every ready job within {radius} mi of a center job. Click a group to see its jobs.</li>
    </ol>
  );
}

function JobRowItem({ job, miles, onSelect }: { job: PlannerJob; miles?: number; onSelect: (jobNo: string) => void }) {
  return (
    <li className="pl-jobrow">
      <span className="pl-pin pl-pin--legend" style={{ background: STATE_COLORS[job.state] }} />
      <button type="button" className="pl-link" onClick={() => onSelect(job.jobNo)}>
        {job.jobNo}
      </button>
      <span className="pl-jobrow__name">{job.name}</span>
      <span className="pl-jobrow__meta">
        {job.kind === "service" ? "Svc · " : ""}
        {job.crewHours ? `${hrs(job.crewHours)} h` : "— h"}
        {miles != null ? ` · ${Math.round(miles)} mi` : ""}
      </span>
    </li>
  );
}

function MustList({
  jobs,
  region,
  canEdit,
  onSelectJob,
}: {
  jobs: PlannerJob[];
  region: RegionPick;
  canEdit: boolean;
  onSelectJob: (jobNo: string) => void;
}) {
  const wk = useInstallQueueStoreWK((s) => s.groups);
  const nek = useInstallQueueStoreNEK((s) => s.groups);
  const regions: Region[] = region === "both" ? ["WK", "NEK"] : [region];
  const byNo = new Map(jobs.map((j) => [j.jobNo, j]));
  return (
    <div className="pl-must">
      {regions.map((r) => {
        const group = (r === "NEK" ? nek : wk).find((g) => sameName(g.name, MUST_THIS_WEEK));
        const items = group?.items ?? [];
        return (
          <section key={r}>
            <h3 className="pl-must__head">
              {r} · {items.length} job{items.length === 1 ? "" : "s"}
            </h3>
            {items.length ? (
              <ul className="pl-joblist">
                {items.map((i) => {
                  const j = byNo.get(i.jobNo);
                  return (
                    <li key={i.id} className="pl-jobrow">
                      <span className="pl-pin pl-pin--legend" style={{ background: STATE_COLORS[j?.state ?? "must"] }} />
                      <button type="button" className="pl-link" onClick={() => onSelectJob(i.jobNo)} disabled={!j}>
                        {i.jobNo}
                      </button>
                      <span className="pl-jobrow__name">{j?.name ?? i.customerName}</span>
                      <span className="pl-jobrow__meta">{j && j.state !== "must" ? STATE_LABELS[j.state] : ""}</span>
                      {canEdit && (
                        <button
                          type="button"
                          className="pl-remove"
                          title="Take off Must this week"
                          aria-label={`Take ${i.jobNo} off Must this week`}
                          onClick={() => queueFor(r).getState().removeItem(i.id)}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="pl-empty pl-empty--small">None yet.</div>
            )}
          </section>
        );
      })}
      <p className="pl-hint">
        Add a job: click its pin, then <b>Must this week</b>. The list is the region's “{MUST_THIS_WEEK}” group in the Install Job
        Queue — clear it out once the week is planned.
      </p>
    </div>
  );
}

function JobDetail({
  job,
  near,
  radius,
  canEdit,
  onSelectJob,
  onPlanTrip,
}: {
  job: PlannerJob;
  near: Array<{ job: PlannerJob; miles: number }>;
  radius: number;
  canEdit: boolean;
  onSelectJob: (jobNo: string) => void;
  onPlanTrip: () => void;
}) {
  const wkGroups = useInstallQueueStoreWK((s) => s.groups);
  const nekGroups = useInstallQueueStoreNEK((s) => s.groups);
  const groups = job.region === "NEK" ? nekGroups : wkGroups;
  const mustItem = groups.find((g) => sameName(g.name, MUST_THIS_WEEK))?.items.find((i) => i.jobNo === job.jobNo);
  const [busy, setBusy] = useState(false);
  const nearHours = near.reduce((s, n) => s + n.job.crewHours, 0);

  const addMust = async () => {
    setBusy(true);
    try {
      const store = queueFor(job.region).getState();
      await store.load();
      await store.addToNamedGroup({ name: MUST_THIS_WEEK, ...MUST_COLOR }, [
        {
          jobNo: job.jobNo,
          customerName: job.name,
          jobDescription: `${job.jobNo} ${job.name}`,
          planningLineDescription: job.kind === "service" ? "Service" : "Install",
          estimatedHours: job.crewHours || 8,
          departmentId: "",
          crewPersons: null,
          crewTrucks: null,
          crewTrips: null,
          installZip: job.zip || null,
          invoiceAmount: null,
          isCustom: false,
          customColor: null,
          customTextColor: null,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pl-job">
      <h3 className="pl-job__title">
        {job.jobNo} <span>{job.name}</span>
      </h3>
      <div className="pl-job__state">
        <span className="pl-pin pl-pin--legend" style={{ background: STATE_COLORS[job.state] }} /> {STATE_LABELS[job.state]} ·{" "}
        {job.kind === "service" ? "Service" : "Install"} · {job.region}
        {job.scheduledDate && <> · on the board {format(new Date(`${job.scheduledDate}T00:00:00`), "MMM d")}</>}
      </div>
      <dl className="pl-job__facts">
        <dt>Address</dt>
        <dd>
          {job.address || "—"} {job.zip}
          {job.approx && <em className="pl-approx"> (pin at the ZIP's center)</em>}
        </dd>
        <dt>Crew hours</dt>
        <dd>{job.crewHours ? `${hrs(job.crewHours)} h (BC install lines)` : "Not in BC yet"}</dd>
      </dl>
      <div className="pl-job__actions">
        {job.address && (
          <a className="btn-secondary" href={googleMapsUrl(`${job.address} ${job.zip}`)} target="_blank" rel="noopener noreferrer">
            Google Maps
          </a>
        )}
        {canEdit && (job.state === "ready" || job.state === "must" || job.state === "production") &&
          (mustItem ? (
            <button type="button" className="btn-secondary" onClick={() => queueFor(job.region).getState().removeItem(mustItem.id)}>
              Take off Must this week
            </button>
          ) : (
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void addMust()}>
              {busy ? "Adding…" : "Must this week"}
            </button>
          ))}
      </div>

      <h4 className="pl-job__sub">
        What fits near this job · within {radius} mi
        {near.length > 0 && (
          <span className="pl-job__subsum">
            {" "}
            — {near.length} job{near.length === 1 ? "" : "s"}, {hrs(nearHours + job.crewHours)} crew h together
          </span>
        )}
      </h4>
      {near.length ? (
        <>
          <ul className="pl-joblist">
            {near.map((n) => (
              <JobRowItem key={n.job.jobNo} job={n.job} miles={n.miles} onSelect={onSelectJob} />
            ))}
          </ul>
          {job.pos && (
            <button type="button" className="btn-secondary pl-plan" onClick={onPlanTrip}>
              Plan a trip with these →
            </button>
          )}
        </>
      ) : (
        <div className="pl-empty pl-empty--small">No ready jobs within {radius} mi — try a bigger radius.</div>
      )}
    </div>
  );
}

function SavedTripList({
  trips,
  weekStart,
  canEdit,
  onOpen,
}: {
  trips: SavedTrip[];
  weekStart: Date;
  canEdit: boolean;
  onOpen: (t: SavedTrip) => void;
}) {
  if (!trips.length) {
    return (
      <div className="pl-empty">
        No trips saved for the week of {format(weekStart, "MMM d")} yet — open a group and <b>Plan trip</b>.
      </div>
    );
  }
  return (
    <ul className="pl-groups">
      {trips.map((t) => (
        <li key={t.id} className="pl-group">
          <div className="pl-group__head">
            <button type="button" className="pl-link" onClick={() => onOpen(t)}>
              {t.name}
            </button>
            <span className="pl-group__region">{t.region}</span>
            {canEdit && (
              <button
                type="button"
                className="pl-remove"
                aria-label={`Delete ${t.name}`}
                title="Delete this trip"
                onClick={() => {
                  if (window.confirm(`Delete the trip "${t.name}"?`)) void useTripStore.getState().remove(t.id);
                }}
              >
                ×
              </button>
            )}
          </div>
          <TripTotals trip={t} />
          <div className="pl-hint">
            {t.stops.length} job{t.stops.length === 1 ? "" : "s"} · from {t.home.name} · saved by {t.savedBy || "—"}
          </div>
        </li>
      ))}
    </ul>
  );
}

function WeekWeather({ zip, weekStart }: { zip: string; weekStart: Date }) {
  if (!zip) return null;
  return (
    <div className="pl-weather" aria-label="Weather this week">
      {[0, 1, 2, 3, 4].map((i) => {
        const d = addDays(weekStart, i);
        return (
          <span key={i} className="pl-weather__day">
            <span className="pl-weather__dow">{format(d, "EEE")}</span>
            <WeatherChip zip={zip} forDate={d} />
          </span>
        );
      })}
    </div>
  );
}

function GeoStatus({ approx, total }: { approx: number; total: number }) {
  const key = useJobGeoStore((s) => s.orsKey);
  const pending = useJobGeoStore((s) => s.pending);
  const err = useJobGeoStore((s) => s.lookupError);
  const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
  let msg = "";
  if (!LIVE) msg = "Sample data — pins at each job's ZIP center.";
  else if (err) msg = err;
  else if (!key) msg = `Pins are at ZIP centers (${approx} of ${total}). Add the openrouteservice key in Settings → Install Planner to place them at the street address.`;
  else if (pending) msg = `Placing ${pending} address${pending === 1 ? "" : "es"} on the map…`;
  else if (approx) msg = `${approx} of ${total} pins are at their ZIP's center (address not found).`;
  if (!msg) return null;
  return <div className={`pl-geostatus${err ? " pl-geostatus--warn" : ""}`}>{msg}</div>;
}

function Segmented({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="pl-seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className={`pl-seg__btn${v === value ? " pl-seg__btn--on" : ""}`} aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="pl-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function TabButton({
  on,
  onClick,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="tab" aria-selected={on} disabled={disabled} className={`pl-tab${on ? " pl-tab--on" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
