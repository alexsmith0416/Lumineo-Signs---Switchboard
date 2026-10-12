import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import TripDays, { TripTotals } from "./TripDays";
import { useInstallationStoreNEK, useInstallationStoreWK } from "../../store/schedule-store";
import { usePlanStore } from "../../store/plan-store";
import { commitWeekPlan } from "../../store/week-plan-commit";
import { loadWeekCrews, type WeekCrews } from "../../services/week-plan-data";
import { planWeek, weekStats, WEEK_DAYS, type Assignment, type PlanCrew, type WeekPlan } from "../../services/week-plan";
import { comparePlans, type PlanOptions, type SavedPlan } from "../../services/saved-plans";
import { duration } from "../../services/saved-trips";
import type { PlannerJob } from "../../services/install-planner";
import type { Region } from "../../services/geo";

type RegionPick = Region | "both";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const hrs = (h: number) => (Math.round(h * 10) / 10).toString();

/** A plan shown here: worked out from the options now, or a saved one reopened. */
interface ShownPlan {
  assignments: Assignment[];
  unplaced: Array<{ jobNo: string; name: string; must: boolean; reason: string }>;
}

/**
 * Auto-plan the week (Install Planner Stage 3, Oct 11, 2026): every Must /
 * ready job turned into trips from the crews' own locations and given to
 * crews with free days; review it on a crew × day grid, untick or move a trip,
 * compare plans, then Commit — cards on the install boards, Scheduled install
 * dates, and the trips for the installers. Admin / Ops.
 */
export default function WeekPlanPanel({
  jobs,
  weekStart,
  region,
  radiusMi,
  crossRegions,
  canEdit,
  userName,
  onClose,
}: {
  jobs: readonly PlannerJob[];
  weekStart: Date;
  region: RegionPick;
  radiusMi: number;
  crossRegions: boolean;
  canEdit: boolean;
  userName: string;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<PlanOptions>({
    radiusMi,
    combineService: false,
    allowOvernight: true,
    maxNights: 2,
    crossRegions: crossRegions && region === "both",
    startHour: 7,
    region,
  });
  const set = (patch: Partial<PlanOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
    setSavedId(null);
    setExcluded(new Set());
    setMoved(new Map());
  };

  // The week's crews and busy days, from both boards.
  const wkDs = useInstallationStoreWK((s) => s.dataSource);
  const nekDs = useInstallationStoreNEK((s) => s.dataSource);
  const [crews, setCrews] = useState<WeekCrews | null>(null);
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    let alive = true;
    void loadWeekCrews(weekStart, [
      { region: "WK", boardKind: "install-wk", ds: wkDs },
      { region: "NEK", boardKind: "install-nek", ds: nekDs },
    ])
      .then((c) => alive && setCrews(c))
      .catch((e) => alive && setLoadErr(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [weekStart, wkDs, nekDs]);

  const regionJobs = useMemo(() => jobs.filter((j) => opts.region === "both" || j.region === opts.region), [jobs, opts.region]);
  const regionCrews = useMemo(
    () => (crews?.crews ?? []).filter((c) => opts.region === "both" || c.region === opts.region),
    [crews, opts.region],
  );
  const run = (allowOvernight: boolean): WeekPlan | null =>
    crews
      ? planWeek({
          jobs: regionJobs,
          crews: regionCrews,
          busy: crews.busy,
          radiusMi: opts.radiusMi,
          combineService: opts.combineService,
          allowOvernight,
          maxNights: opts.maxNights,
          crossRegions: opts.crossRegions,
        })
      : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const computed = useMemo(() => run(opts.allowOvernight), [crews, regionJobs, regionCrews, opts]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const other = useMemo(() => run(!opts.allowOvernight), [crews, regionJobs, regionCrews, opts]);

  // Reopened saved plan (a snapshot) or the computed one.
  const plans = usePlanStore((s) => s.plans);
  useEffect(() => {
    void usePlanStore.getState().load();
  }, []);
  const weekKey = format(weekStart, "yyyy-MM-dd");
  const weekPlans = plans.filter((p) => p.weekStart === weekKey);
  const [savedId, setSavedId] = useState<string | null>(null);
  const saved = weekPlans.find((p) => p.id === savedId) ?? null;
  const base: ShownPlan | null = saved
    ? { assignments: saved.assignments, unplaced: saved.unplaced }
    : computed
      ? {
          assignments: computed.assignments,
          unplaced: computed.unplaced.map((u) => ({ jobNo: u.job.jobNo, name: u.job.name, must: u.job.state === "must", reason: u.reason })),
        }
      : null;

  // Review edits: trips left off, trips moved to another crew.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [moved, setMoved] = useState<Map<string, { crewId: string; crewName: string; startDay: number }>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const effective: Assignment[] = useMemo(
    () => (base?.assignments ?? []).filter((a) => !excluded.has(a.trip.id)).map((a) => ({ ...a, ...(moved.get(a.trip.id) ?? {}) })),
    [base, excluded, moved],
  );
  // "Didn't fit" is counted below (planner + left off in review), not here.
  const stats = useMemo(() => weekStats(effective, [], regionJobs), [effective, regionJobs]);
  const leftOff = (base?.assignments ?? []).filter((a) => excluded.has(a.trip.id));

  const takenDays = (crewId: string, exceptTrip: string) => {
    const t = new Set(crews?.busy.get(crewId) ?? []);
    for (const a of effective) {
      if (a.crewId !== crewId || a.trip.id === exceptTrip) continue;
      for (let d = a.startDay; d < a.startDay + a.trip.plan.days.length; d++) t.add(d);
    }
    return t;
  };
  const freeStart = (crewId: string, a: Assignment) => {
    const t = takenDays(crewId, a.trip.id);
    const n = a.trip.plan.days.length;
    for (let s = 0; s + n <= WEEK_DAYS; s++) if (![...Array(n).keys()].some((i) => t.has(s + i))) return s;
    return -1;
  };

  const [busy, setBusy] = useState<"" | "saving" | "committing">("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [compare, setCompare] = useState<[string, string]>(["current", ""]);

  const snapshot = (): SavedPlan => ({
    id: saved?.id ?? crypto.randomUUID(),
    name: name.trim() || saved?.name || `Week of ${format(weekStart, "MMM d")} · ${opts.region === "both" ? "WK + NEK" : opts.region}${opts.allowOvernight ? "" : " · no overnights"}`,
    weekStart: weekKey,
    options: opts,
    assignments: effective,
    unplaced: [
      ...(base?.unplaced ?? []),
      ...leftOff.flatMap((a) => a.trip.stops.map((s) => ({ jobNo: s.jobNo, name: s.name, must: false, reason: "Left off in review." }))),
    ],
    stats: { ...stats, unplaced: (base?.unplaced.length ?? 0) + leftOff.reduce((n, a) => n + a.trip.stops.length, 0) },
    savedBy: userName,
    savedAt: new Date().toISOString(),
    committedAt: saved?.committedAt ?? "",
  });
  const savePlan = async () => {
    setBusy("saving");
    const p = snapshot();
    await usePlanStore.getState().save(p);
    setSavedId(p.id);
    setName(p.name);
    setBusy("");
    setMsg(`Saved “${p.name}”.`);
  };
  const commit = async () => {
    if (!crews || !effective.length) return;
    const cardCount = effective.reduce((n, a) => n + a.trip.plan.days.reduce((m, d) => m + d.events.filter((e) => e.type === "work").length, 0), 0);
    if (!window.confirm(`Put ${cardCount} card${cardCount === 1 ? "" : "s"} for ${effective.length} trip${effective.length === 1 ? "" : "s"} on the install boards for the week of ${format(weekStart, "MMM d")}?`)) return;
    setBusy("committing");
    try {
      const r = await commitWeekPlan({ assignments: effective, weekStart, startHour: opts.startHour, maxNights: opts.maxNights, crews, userName });
      const p = { ...snapshot(), committedAt: new Date().toISOString() };
      await usePlanStore.getState().save(p);
      setSavedId(p.id);
      setMsg(`Committed: ${r.cards} cards on the install boards, ${r.trips} trips for the installers.`);
    } catch (e) {
      setMsg(`Commit stopped: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  };

  const delta = computed && other ? other.stats.jobs - computed.stats.jobs : 0;
  const sel = effective.find((a) => a.trip.id === selected) ?? null;
  const byBase = useMemo(() => {
    const m = new Map<string, PlanCrew[]>();
    for (const c of regionCrews) m.set(c.base, [...(m.get(c.base) ?? []), c]);
    return [...m.entries()];
  }, [regionCrews]);
  const label = (a: Assignment) => `T${(base?.assignments ?? []).indexOf(base!.assignments.find((x) => x.trip.id === a.trip.id)!) + 1}`;

  return (
    <div className="wp-overlay" role="dialog" aria-modal="true" aria-label="Auto-plan the week">
      <div className="wp">
        <header className="wp-head">
          <h2>Auto-plan · week of {format(weekStart, "MMM d")}</h2>
          {saved && <span className="pl-badge pl-badge--night">{saved.committedAt ? "Committed" : "Saved"}: {saved.name}</span>}
          <button type="button" className="pl-remove" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="wp-options">
          <label className="tr-field">
            <span className="tr-label">Region</span>
            <select value={opts.region} onChange={(e) => set({ region: e.target.value, crossRegions: false })}>
              <option value="WK">WK</option>
              <option value="NEK">NEK</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="tr-field">
            <span className="tr-label">Group radius</span>
            <select value={opts.radiusMi} onChange={(e) => set({ radiusMi: Number(e.target.value) })}>
              {[10, 15, 20, 25, 30, 40, 50, 60, 75, 100].map((r) => (
                <option key={r} value={r}>
                  {r} mi
                </option>
              ))}
            </select>
          </label>
          <label className="pl-check">
            <input type="checkbox" checked={opts.combineService} onChange={(e) => set({ combineService: e.target.checked })} /> Combine service with
            install
          </label>
          <label className="pl-check">
            <input type="checkbox" checked={opts.allowOvernight} onChange={(e) => set({ allowOvernight: e.target.checked })} /> Allow overnights
          </label>
          <label className="tr-field">
            <span className="tr-label">Max nights</span>
            <select value={opts.maxNights} onChange={(e) => set({ maxNights: Number(e.target.value) })} disabled={!opts.allowOvernight}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <label className="tr-field">
            <span className="tr-label">Leave at</span>
            <select value={opts.startHour} onChange={(e) => set({ startHour: Number(e.target.value) })}>
              {[6, 6.5, 7, 7.5, 8].map((h) => (
                <option key={h} value={h}>{`${Math.floor(h)}:${h % 1 ? "30" : "00"} AM`}</option>
              ))}
            </select>
          </label>
          {opts.region === "both" && (
            <label className="pl-check">
              <input type="checkbox" checked={opts.crossRegions} onChange={(e) => set({ crossRegions: e.target.checked })} /> Let regions share trips
            </label>
          )}
          {saved && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSavedId(null);
                setExcluded(new Set());
                setMoved(new Map());
                setSelected(null);
              }}
            >
              Back to a fresh plan
            </button>
          )}
        </div>

        {loadErr && <div className="pl-error">Couldn't read the install boards: {loadErr}</div>}
        {!crews ? (
          <div className="pl-empty">Reading the crews and the week's cards…</div>
        ) : (
          <>
            <div className="wp-stats">
              <Stat label="Jobs planned" value={`${stats.jobs}`} />
              <Stat label="Must this week" value={`${stats.mustJobs} of ${stats.mustTotal}`} warn={stats.mustJobs < stats.mustTotal} />
              <Stat label="Crew hours" value={hrs(stats.crewHours)} />
              <Stat label="Driving" value={`${duration(stats.driveHours)} · ${Math.round(stats.miles)} mi`} />
              <Stat label="Nights" value={`${stats.nights}`} />
              <Stat label="Crew-days" value={`${stats.crewDays}`} />
              <Stat label="Didn't fit" value={`${(base?.unplaced.length ?? 0) + leftOff.reduce((n, a) => n + a.trip.stops.length, 0)}`} />
              {!saved && computed && other && (
                <div className={`wp-delta${delta > 0 ? " wp-delta--up" : ""}`}>
                  {opts.allowOvernight
                    ? delta < 0
                      ? `Overnights add ${-delta} job${delta === -1 ? "" : "s"} this week.`
                      : "Overnights don't add any jobs this week."
                    : delta > 0
                      ? `Allowing overnights would add ${delta} job${delta === 1 ? "" : "s"}.`
                      : "Allowing overnights wouldn't add any jobs."}
                </div>
              )}
            </div>

            <div className="wp-body">
              <div className="wp-grid-wrap">
                <table className="wp-grid">
                  <thead>
                    <tr>
                      <th>Crew</th>
                      {DAY_NAMES.map((d, i) => (
                        <th key={d}>
                          {d} {format(addDays(weekStart, i), "M/d")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byBase.map(([baseName, list]) => (
                      <CrewRows
                        key={baseName}
                        baseName={baseName}
                        crews={list}
                        busy={crews.busy}
                        assignments={effective}
                        selected={selected}
                        label={label}
                        onSelect={setSelected}
                      />
                    ))}
                    {!byBase.length && (
                      <tr>
                        <td colSpan={6} className="pl-empty">
                          No install crews found on the boards.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <aside className="wp-side">
                {sel ? (
                  <div className="wp-trip">
                    <div className="tr-head">
                      <h3>
                        {label(sel)} · {sel.crewName} · from {sel.trip.home.name}
                      </h3>
                    </div>
                    <TripTotals trip={{ ...sel.trip, startHour: opts.startHour, source: "estimate" }} />
                    {canEdit && !saved?.committedAt && (
                      <div className="wp-trip__edit">
                        <label className="tr-field">
                          <span className="tr-label">Crew</span>
                          <select
                            value={sel.crewId}
                            onChange={(e) => {
                              const crew = regionCrews.find((c) => c.id === e.target.value)!;
                              const start = freeStart(crew.id, sel);
                              if (start < 0) return;
                              setMoved((m) => new Map(m).set(sel.trip.id, { crewId: crew.id, crewName: crew.name, startDay: start }));
                            }}
                          >
                            {regionCrews
                              .filter((c) => c.base === sel.trip.home.name)
                              .map((c) => {
                                const ok = c.id === sel.crewId || freeStart(c.id, sel) >= 0;
                                return (
                                  <option key={c.id} value={c.id} disabled={!ok}>
                                    {c.name}
                                    {ok ? "" : " (no room)"}
                                  </option>
                                );
                              })}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setExcluded((x) => new Set(x).add(sel.trip.id));
                            setSelected(null);
                          }}
                        >
                          Leave this trip off
                        </button>
                      </div>
                    )}
                    <TripDays trip={{ ...sel.trip, startHour: opts.startHour, source: "estimate" }} />
                  </div>
                ) : (
                  <div className="pl-hint">Click a trip on the grid to see it day by day, move it to another crew or leave it off.</div>
                )}

                {leftOff.length > 0 && (
                  <section className="wp-list">
                    <h4>Left off ({leftOff.length})</h4>
                    {leftOff.map((a) => (
                      <div key={a.trip.id} className="wp-list__row">
                        {label(a)} · {a.trip.stops.map((s) => s.jobNo).join(", ")}
                        <button type="button" className="pl-link" onClick={() => setExcluded((x) => new Set([...x].filter((id) => id !== a.trip.id)))}>
                          Put back
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                {(base?.unplaced.length ?? 0) > 0 && (
                  <section className="wp-list">
                    <h4>Didn't fit ({base!.unplaced.length})</h4>
                    {base!.unplaced.map((u) => (
                      <div key={u.jobNo} className="wp-list__row">
                        {u.must && <span className="pl-badge pl-badge--must">must</span>} <b>{u.jobNo}</b> {u.name} — {u.reason}
                      </div>
                    ))}
                  </section>
                )}
              </aside>
            </div>

            <footer className="wp-foot">
              {canEdit && (
                <>
                  <input
                    className="form-field__input tr-name"
                    value={name}
                    placeholder={saved?.name ?? `Week of ${format(weekStart, "MMM d")} plan`}
                    onChange={(e) => setName(e.target.value)}
                    aria-label="Plan name"
                  />
                  <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => void savePlan()}>
                    {busy === "saving" ? "Saving…" : saved ? "Save changes" : "Save plan"}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!!busy || !effective.length || !!saved?.committedAt}
                    onClick={() => void commit()}
                    title={saved?.committedAt ? "This plan is already on the boards" : "Put these trips on the install boards"}
                  >
                    {busy === "committing" ? "Committing…" : `Commit ${effective.length} trip${effective.length === 1 ? "" : "s"}`}
                  </button>
                </>
              )}
              {msg && <span className="wp-msg">{msg}</span>}
            </footer>

            <SavedPlans
              plans={weekPlans}
              current={snapshot}
              savedId={savedId}
              compare={compare}
              onCompare={setCompare}
              onOpen={(id) => {
                setSavedId(id);
                setExcluded(new Set());
                setMoved(new Map());
                setSelected(null);
              }}
              canEdit={canEdit}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`wp-stat${warn ? " wp-stat--warn" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function CrewRows({
  baseName,
  crews,
  busy,
  assignments,
  selected,
  label,
  onSelect,
}: {
  baseName: string;
  crews: PlanCrew[];
  busy: ReadonlyMap<string, ReadonlySet<number>>;
  assignments: readonly Assignment[];
  selected: string | null;
  label: (a: Assignment) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <tr className="wp-base">
        <th colSpan={6}>{baseName}</th>
      </tr>
      {crews.map((c) => {
        const cells: JSX.Element[] = [];
        for (let d = 0; d < WEEK_DAYS; ) {
          const a = assignments.find((x) => x.crewId === c.id && x.startDay === d);
          if (a) {
            const span = a.trip.plan.days.length;
            cells.push(
              <td key={d} colSpan={span}>
                <button type="button" className={`wp-trip-block${a.trip.id === selected ? " wp-trip-block--on" : ""}`} onClick={() => onSelect(a.trip.id)}>
                  <b>{label(a)}</b> {a.trip.stops.length} job{a.trip.stops.length === 1 ? "" : "s"}
                  {a.trip.mustCount > 0 && <span className="pl-badge pl-badge--must">{a.trip.mustCount} must</span>}
                  {a.trip.plan.nights > 0 && <span className="pl-badge pl-badge--night">{a.trip.plan.nights}n</span>}
                </button>
              </td>,
            );
            d += span;
          } else {
            cells.push(<td key={d} className={busy.get(c.id)?.has(d) ? "wp-busy" : ""}>{busy.get(c.id)?.has(d) ? "On board" : ""}</td>);
            d++;
          }
        }
        return (
          <tr key={c.id}>
            <th className="wp-crew">{c.name}</th>
            {cells}
          </tr>
        );
      })}
    </>
  );
}

function SavedPlans({
  plans,
  current,
  savedId,
  compare,
  onCompare,
  onOpen,
  canEdit,
}: {
  plans: SavedPlan[];
  current: () => SavedPlan;
  savedId: string | null;
  compare: [string, string];
  onCompare: (c: [string, string]) => void;
  onOpen: (id: string) => void;
  canEdit: boolean;
}) {
  const pick = (id: string): SavedPlan | null => (id === "current" ? current() : plans.find((p) => p.id === id) ?? null);
  const a = pick(compare[0]);
  const b = pick(compare[1]);
  const c = a && b ? comparePlans(a, b) : null;
  const options = [{ id: "current", name: "This plan (on screen)" }, ...plans.map((p) => ({ id: p.id, name: `${p.name}${p.committedAt ? " ✓" : ""}` }))];
  return (
    <section className="wp-saved">
      <h3>Saved plans for this week</h3>
      {plans.length ? (
        <ul className="wp-saved__list">
          {plans.map((p) => (
            <li key={p.id} className={p.id === savedId ? "wp-saved--on" : ""}>
              <button type="button" className="pl-link" onClick={() => onOpen(p.id)}>
                {p.name}
              </button>{" "}
              · {p.stats.jobs} jobs · {duration(p.stats.driveHours)} driving · {p.stats.nights} nights
              {p.committedAt && <span className="pl-badge pl-badge--night">committed</span>} · {p.savedBy || "—"}
              {canEdit && !p.committedAt && (
                <button
                  type="button"
                  className="pl-remove"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete the plan "${p.name}"?`)) void usePlanStore.getState().remove(p.id);
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="pl-hint">None yet — Save plan keeps the one on screen so you can compare it with another.</div>
      )}
      <div className="wp-compare">
        <span className="tr-label">Compare</span>
        <select value={compare[0]} onChange={(e) => onCompare([e.target.value, compare[1]])}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span>with</span>
        <select value={compare[1]} onChange={(e) => onCompare([compare[0], e.target.value])}>
          <option value="">— pick a plan —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      {c && a && b && (
        <table className="wp-cmp">
          <thead>
            <tr>
              <th />
              <th>{a.name}</th>
              <th>{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.label}>
                <th>{r.label}</th>
                <td className={r.winner === "a" ? "wp-win" : ""}>{hrs(r.a)}</td>
                <td className={r.winner === "b" ? "wp-win" : ""}>{hrs(r.b)}</td>
              </tr>
            ))}
            <tr>
              <th>Only in this plan</th>
              <td>{c.onlyA.join(", ") || "—"}</td>
              <td>{c.onlyB.join(", ") || "—"}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
