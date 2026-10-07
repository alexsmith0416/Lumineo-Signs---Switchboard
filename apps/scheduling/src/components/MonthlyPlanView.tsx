import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useInstallationStoreNEK, useInstallationStoreWK } from "../store/schedule-store";
import { useInstallQueueStoreNEK, useInstallQueueStoreWK } from "../store/job-queue-store";
import { useBillingPeriodStore } from "../store/billing-period-store";
import { useJobTrackingStore } from "../store/job-tracking-store";
import { useJobScheduleStore } from "../store/job-schedule-store";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { useJobDeptOverrideStore } from "../store/job-dept-override-store";
import { useStepQueueData } from "../store/step-queue-store";
import { useJobRows } from "../hooks/useJobRows";
import { billingPeriodFor } from "../services/billing-periods";
import { buildDepartmentSteps } from "../services/production-steps";
import {
  autofill,
  bookedByWeek,
  buildPools,
  type AutofillResult,
  type BookedLine,
  type PlanCandidate,
  type PlanJob,
  type Region,
} from "../services/gameplan";
import { cardMoneyValue } from "./JobCard";
import { stepOrderFor, useJobFlowStore } from "../store/job-flow-store";

/**
 * Monthly Gameplanning — install billing for the current billing month.
 * Booked $ comes from every WK / NEK install card (each job once, in the week
 * its install ends); the pools come from the Jobs list + steppers + BC install
 * planning lines. All the logic is in services/gameplan.ts.
 */

const HOURS_PER_CREW_WEEK = 40;
const PLANNED_COLOR = { color: "#141464", textColor: "#FFFFFF" };

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}
const shortDate = (s: string) => (s ? format(parseISO(s), "MMM d") : "—");

type PoolKey = "pastDue" | "ready" | "near";
const POOLS: Array<{ key: PoolKey; title: string; blurb: string; accent: string }> = [
  {
    key: "pastDue",
    title: "Past due",
    blurb: "Not installed yet, and the date it was needed by (RED date, else Scheduled install, else Install Target) has passed. Needs attention now. Auto-fill places these first.",
    accent: "var(--lumineo-red)",
  },
  {
    key: "ready",
    title: "Ready for install",
    blurb: "Production is done (Install is the active step) and it isn't on an install board yet.",
    accent: "var(--status-green)",
  },
  {
    key: "near",
    title: "Near complete",
    blurb: "One production step left and not on an install board yet. Auto-fill plans these for the week after their Mfg Final date.",
    accent: "var(--status-amber)",
  },
];

export default function MonthlyPlanView({ canEdit }: { canEdit: boolean }) {
  const [anchorDate] = useState<Date>(new Date());
  const [proposal, setProposal] = useState<AutofillResult | null>(null);
  const [pool, setPool] = useState<PoolKey>("pastDue");

  // ── The billing period (fiscal month) — dates from each month's billing cut-off.
  const periodRows = useBillingPeriodStore((s) => s.rows);
  const loadPeriods = useBillingPeriodStore((s) => s.load);
  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);
  const period = useMemo(() => billingPeriodFor(anchorDate, periodRows), [anchorDate, periodRows]);
  const goal = period.goal;

  // ── Every install card around the period, both regions. A job's earlier
  // cards can start weeks before; a later card after the period moves its
  // billing out — so read a margin either side.
  const wkDs = useInstallationStoreWK((s) => s.dataSource);
  const nekDs = useInstallationStoreNEK((s) => s.dataSource);
  const [booked, setBooked] = useState<BookedLine[] | null>(null);
  const [crews, setCrews] = useState<Record<Region, number>>({ WK: 0, NEK: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadBooked = useCallback(async () => {
    try {
      const from = addDays(period.start, -42);
      const to = addDays(period.end, 90);
      const [wk, nek, wkCrews, nekCrews] = await Promise.all([
        wkDs.loadScheduleLines(from, to),
        nekDs.loadScheduleLines(from, to),
        wkDs.loadEmployees(),
        nekDs.loadEmployees(),
      ]);
      const toBooked = (region: Region) => (l: (typeof wk)[number]): BookedLine => ({
        jobNo: l.jobNo,
        region,
        startDateTime: l.startDateTime,
        endDateTime: l.endDateTime,
        value: cardMoneyValue(l),
        hours: l.overrideHours ?? l.estimatedHours ?? 0,
      });
      const real = (l: (typeof wk)[number]) => !!l.jobNo && !l.isCustom && !l.shipmentLoadId;
      setBooked([...wk.filter(real).map(toBooked("WK")), ...nek.filter(real).map(toBooked("NEK"))]);
      setCrews({ WK: wkCrews.length, NEK: nekCrews.length });
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setBooked([]);
    }
  }, [wkDs, nekDs, period.start, period.end]);
  useEffect(() => {
    void loadBooked();
  }, [loadBooked]);

  const slots = useMemo(() => bookedByWeek(booked ?? [], period), [booked, period]);
  const wkTotal = slots.reduce((n, s) => n + s.wk, 0);
  const nekTotal = slots.reduce((n, s) => n + s.nek, 0);
  const combined = wkTotal + nekTotal;
  const gap = Math.max(0, goal - combined);
  const goalProgress = goal > 0 ? combined / goal : 0;
  const weeklyTarget = slots.length ? goal / slots.length : 0;

  // ── The pools: Jobs list rows + steppers + BC install planning lines.
  const rows = useJobRows();
  const stepInfo = useJobTrackingStore((s) => s.stepInfo);
  const completions = useJobDeptCompletionStore((s) => s.byJob);
  const loadCompletions = useJobDeptCompletionStore((s) => s.load);
  const overrides = useJobDeptOverrideStore((s) => s.byJob);
  const flowCompany = useJobFlowStore((s) => s.company);
  const planLines = useStepQueueData((s) => s.lines);
  const scheduled = useStepQueueData((s) => s.scheduled);
  const loadPlanLines = useStepQueueData((s) => s.load);
  const jobsLoaded = useJobTrackingStore((s) => s.loaded);
  useEffect(() => {
    void loadCompletions();
    void loadPlanLines(true);
  }, [loadCompletions, loadPlanLines]);

  const pools = useMemo(() => {
    const onBoard = new Set<string>();
    for (const key of scheduled) if (key.endsWith("|Install")) onBoard.add(key.slice(0, -"|Install".length));
    for (const l of booked ?? []) onBoard.add(l.jobNo);
    const jobs: PlanJob[] = rows.map((r) => ({
      jobNo: r.jobNo,
      name: r.name,
      description: r.job,
      status: r.status,
      installRegion: r.installRegion || r.region,
      value: r.remaining != null && r.remaining > 0 ? r.remaining : r.value ?? 0,
      redDate: r.redDate,
      scheduledInstall: r.scheduledInstall,
      installTarget: r.installTarget,
      mfgFinalDate: r.mfgFinalDate,
      inBc: r.inBc,
      tracked: r.tracked,
    }));
    return buildPools({
      jobs,
      stepsFor: (jobNo) => {
        const info = stepInfo.get(jobNo) ?? { production: [], hasInstall: false };
        return buildDepartmentSteps(
          info.production,
          new Set(Object.keys(completions[jobNo] ?? {})),
          info.hasInstall,
          overrides[jobNo] ?? {},
          stepOrderFor(jobNo),
        );
      },
      installLinesFor: (jobNo) => (planLines.get(jobNo) ?? []).filter((l) => l.isInstall),
      onBoard,
      today: new Date(),
    });
    // flowCompany: a changed company flow re-orders every job's steps.
  }, [rows, stepInfo, completions, overrides, planLines, scheduled, booked, flowCompany]);

  const runAutofill = () => {
    setProposal(
      autofill({
        candidates: [...pools.ready, ...pools.near],
        weeks: slots,
        goal,
        crewHours: { WK: crews.WK * HOURS_PER_CREW_WEEK, NEK: crews.NEK * HOURS_PER_CREW_WEEK },
        today: new Date(),
      }),
    );
  };

  const shown = pools[pool];
  const loading = booked == null || !jobsLoaded;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "8px 12px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Stat
          label={`${format(new Date(`${period.month}-01T00:00:00`), "MMMM yyyy")} billing · installs ending ${format(period.start, "MMM d")} – ${format(period.lastInstallDay, "MMM d")}`}
          value=""
          highlight
        />
        <Stat label="Monthly goal" value={formatMoney(goal)} money />
        <Stat label="Booked" value={loading ? "…" : formatMoney(combined)} money={goalProgress >= 1} warning={goalProgress < 0.9} />
        <Stat label="WK" value={formatMoney(wkTotal)} money />
        <Stat label="NEK" value={formatMoney(nekTotal)} money />
        <Stat label="Progress" value={`${Math.round(goalProgress * 100)}%`} warning={goalProgress < 0.9} money={goalProgress >= 1} />
        <Stat label="Gap" value={gap > 0 ? formatMoney(gap) : "✓ on track"} warning={gap > 0} money={gap === 0} />
        <div style={{ flex: 1 }} />
        <button className="btn-secondary" onClick={() => void loadBooked()} title="Re-read the install boards">
          ↻ Refresh
        </button>
        <button className="btn-primary" onClick={runAutofill} disabled={loading} title="Plan Ready and Near-complete jobs into this month's weeks">
          ✨ Auto-fill to {formatMoney(goal)}
        </button>
      </div>
      {loadError && (
        <div style={{ color: "var(--lumineo-red)", fontSize: 12, marginBottom: 8 }}>Couldn't read the install boards: {loadError}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 16 }}>
        {slots.map((slot) => {
          const onTrack = slot.total >= weeklyTarget * 0.85;
          return (
            <div
              key={slot.weekStart.toISOString()}
              title={slot.jobs.map((j) => `${j.jobNo} (${j.region}) ${formatMoney(j.value)}`).join("\n") || "Nothing billing this week yet"}
              style={{
                padding: 12,
                border: `1px solid ${onTrack ? "rgba(48,108,180,0.4)" : "rgba(232,21,27,0.35)"}`,
                borderRadius: 6,
                background: "var(--surface-raised)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Week of {format(slot.weekStart, "MMM d")}</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: slot.total > 0 ? "var(--status-green)" : "var(--text-tertiary)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {formatMoney(slot.total)}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                WK {formatMoney(slot.wk)} · NEK {formatMoney(slot.nek)}
              </div>
              <div style={{ marginTop: 6, height: 6, background: "var(--bg-tertiary)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${weeklyTarget ? Math.min(100, (slot.total / weeklyTarget) * 100) : 0}%`,
                    background: onTrack ? "var(--status-green)" : "var(--lumineo-red)",
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-tertiary)" }}>
                target {formatMoney(weeklyTarget)} · {slot.jobs.length} job{slot.jobs.length === 1 ? "" : "s"} · crew hrs WK{" "}
                {Math.round(slot.hoursWK)}/{crews.WK * HOURS_PER_CREW_WEEK} · NEK {Math.round(slot.hoursNEK)}/{crews.NEK * HOURS_PER_CREW_WEEK}
              </div>
            </div>
          );
        })}
      </div>

      {proposal && (
        <AutofillProposal proposal={proposal} canEdit={canEdit} onClose={() => setProposal(null)} onCommitted={() => void loadBooked()} />
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {POOLS.map((p) => (
          <button
            key={p.key}
            className={pool === p.key ? "btn-primary" : "btn-secondary"}
            style={pool === p.key ? { background: p.accent, borderColor: p.accent } : undefined}
            onClick={() => setPool(p.key)}
          >
            {p.title} · {pools[p.key].length} · {formatMoney(pools[p.key].reduce((n, c) => n + c.value, 0))}
          </button>
        ))}
      </div>
      <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginBottom: 8 }}>{POOLS.find((p) => p.key === pool)!.blurb}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--bg-secondary)" }}>
            <Th>Job</Th>
            <Th>Name</Th>
            <Th>Region</Th>
            <Th>Current status</Th>
            <Th>Needed by</Th>
            {pool === "pastDue" && <Th align="right">Days late</Th>}
            {pool === "pastDue" && <Th>Install board</Th>}
            {pool === "near" && <Th>Mfg Final</Th>}
            <Th align="right">Install hrs</Th>
            <Th align="right">Crew</Th>
            <Th align="right">Value</Th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <Td colSpan={11} style={{ color: "var(--text-tertiary)" }}>Loading jobs…</Td>
            </tr>
          )}
          {!loading && shown.length === 0 && (
            <tr>
              <Td colSpan={11} style={{ color: "var(--text-tertiary)" }}>No jobs here right now.</Td>
            </tr>
          )}
          {!loading &&
            shown.map((c) => (
              <tr key={c.jobNo} style={{ borderTop: "1px solid var(--border)" }}>
                <Td style={{ fontWeight: 600 }}>{c.jobNo}</Td>
                <Td>
                  <div>{c.name}</div>
                  {c.description && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.description}</div>}
                </Td>
                <Td>{c.region}</Td>
                <Td>{c.status}</Td>
                <Td title={c.neededBySource}>
                  {shortDate(c.neededBy)}
                  {c.neededBySource && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}> · {c.neededBySource}</span>}
                </Td>
                {pool === "pastDue" && (
                  <Td align="right" style={{ color: "var(--lumineo-red)", fontWeight: 700 }}>{c.daysLate}</Td>
                )}
                {pool === "pastDue" && <Td>{c.onBoard ? "On the board" : <span style={{ color: "var(--lumineo-red)" }}>Not scheduled</span>}</Td>}
                {pool === "near" && <Td>{shortDate(c.mfgFinalDate)}</Td>}
                <Td align="right">{c.installHours || "—"}</Td>
                <Td align="right">{c.crewPersons ? `${c.crewPersons} man` : "—"}</Td>
                <Td align="right" style={{ color: "var(--status-green)", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {c.value > 0 ? formatMoney(c.value) : "—"}
                </Td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        padding: "6px 8px",
        textAlign: align,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        color: "var(--text-secondary)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  style,
  colSpan,
  title,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  style?: React.CSSProperties;
  colSpan?: number;
  title?: string;
}) {
  return (
    <td colSpan={colSpan} title={title} style={{ padding: "6px 8px", textAlign: align, verticalAlign: "top", ...style }}>
      {children}
    </td>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  money = false,
  warning = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  money?: boolean;
  warning?: boolean;
}) {
  let color: string = "var(--text-primary)";
  if (highlight) color = "var(--lumineo-navy)";
  if (money) color = "var(--status-green)";
  if (warning) color = "var(--status-amber)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-tertiary)" }}>{label}</span>
      <strong style={{ color, fontSize: 14 }}>{value}</strong>
    </div>
  );
}

// ── The proposal: untick anything you don't want, then Commit. ──────────────

function AutofillProposal({
  proposal,
  canEdit,
  onClose,
  onCommitted,
}: {
  proposal: AutofillResult;
  canEdit: boolean;
  onClose: () => void;
  onCommitted: () => void;
}) {
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = proposal.placed.filter((p) => !skip.has(p.candidate.jobNo));
  const total = chosen.reduce((n, p) => n + p.candidate.value, 0);
  const updateSchedule = useJobScheduleStore((s) => s.update);
  const loadSchedules = useJobScheduleStore((s) => s.load);

  // Group by week for display.
  const byWeek = new Map<number, typeof proposal.placed>();
  for (const p of proposal.placed) {
    const k = p.weekStart.getTime();
    byWeek.set(k, [...(byWeek.get(k) ?? []), p]);
  }

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadSchedules();
      // 1. Scheduled install = the Monday of its planned week (shows on the Jobs list and boards).
      for (const p of chosen) await updateSchedule(p.candidate.jobNo, { scheduledInstallDate: p.weekStart });
      // 2. A "Planned · week of …" group in that region's Install Job Queue, ready to drag onto the board.
      const groups = new Map<string, { region: Region; weekStart: Date; items: PlanCandidate[] }>();
      for (const p of chosen) {
        const key = `${p.candidate.region}|${p.weekStart.getTime()}`;
        const g = groups.get(key) ?? { region: p.candidate.region, weekStart: p.weekStart, items: [] };
        g.items.push(p.candidate);
        groups.set(key, g);
      }
      for (const g of groups.values()) {
        const store = g.region === "NEK" ? useInstallQueueStoreNEK : useInstallQueueStoreWK;
        await store.getState().load();
        await store.getState().addToNamedGroup(
          { name: `Planned · week of ${format(g.weekStart, "MMM d")}`, ...PLANNED_COLOR },
          g.items.map((c) => ({
            jobNo: c.jobNo,
            customerName: c.name,
            jobDescription: c.description,
            planningLineDescription: "Install",
            estimatedHours: c.installHours || 8,
            departmentId: "",
            crewPersons: c.crewPersons,
            crewTrucks: null,
            crewTrips: null,
            installZip: null,
            invoiceAmount: c.value || null,
            isCustom: false,
            customColor: null,
            customTextColor: null,
          })),
        );
      }
      onCommitted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">Auto-fill proposal</div>
        <div style={{ padding: 12, overflow: "auto" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            {chosen.length} job{chosen.length === 1 ? "" : "s"} adding{" "}
            <strong style={{ color: "var(--status-green)" }}>{formatMoney(total)}</strong> toward the monthly goal.
            {proposal.remainingGap > 0 ? (
              <>
                {" "}
                Still short: <strong style={{ color: "var(--lumineo-red)" }}>{formatMoney(proposal.remainingGap)}</strong>.
              </>
            ) : (
              <>
                {" "}
                <strong style={{ color: "var(--status-green)" }}>Goal reached.</strong>
              </>
            )}
            <div style={{ marginTop: 4, fontSize: 11 }}>
              Untick anything you don't want. Commit sets each job's Scheduled install to its week and adds it to a
              "Planned · week of …" group in that region's Install Job Queue.
            </div>
          </div>

          {proposal.placed.length === 0 && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Nothing to add — see below for why.</div>
          )}
          {[...byWeek].map(([k, items]) => (
            <div key={k}>
              <h4 style={{ margin: "12px 0 4px", fontSize: 12 }}>Week of {format(new Date(k), "MMM d")}</h4>
              {items.map(({ candidate: c }) => (
                <label
                  key={c.jobNo}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: 8,
                    marginBottom: 4,
                    background: "var(--bg-secondary)",
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: "pointer",
                    opacity: skip.has(c.jobNo) ? 0.5 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!skip.has(c.jobNo)}
                    onChange={() =>
                      setSkip((s) => {
                        const n = new Set(s);
                        if (n.has(c.jobNo)) n.delete(c.jobNo);
                        else n.add(c.jobNo);
                        return n;
                      })
                    }
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {c.jobNo} · {c.name}
                      <span style={{ color: "var(--status-green)", marginLeft: 6 }}>{formatMoney(c.value)}</span>
                      {c.daysLate > 0 && (
                        <span style={{ color: "var(--lumineo-red)", marginLeft: 6 }}>{c.daysLate} days late</span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>
                      {c.region} · {c.stage === "ready" ? "Ready" : "Near complete"} · {c.installHours || 8}h
                      {c.crewPersons ? ` · ${c.crewPersons} man` : ""} · needed {shortDate(c.neededBy)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ))}

          {proposal.skipped.length > 0 && (
            <>
              <h4 style={{ margin: "16px 0 4px", fontSize: 12 }}>Not planned</h4>
              {proposal.skipped.map((r) => (
                <div key={r.candidate.jobNo} style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "2px 0" }}>
                  {r.candidate.jobNo} {r.candidate.name} — {r.reason}
                </div>
              ))}
            </>
          )}
          {error && <div style={{ color: "var(--lumineo-red)", fontSize: 12, marginTop: 8 }}>Commit failed: {error}</div>}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!canEdit || busy || chosen.length === 0}
            title={canEdit ? undefined : "You need schedule edit access to commit"}
            onClick={() => void commit()}
          >
            {busy ? "Committing…" : `Commit ${chosen.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
