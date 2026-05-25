import { useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  endOfMonth,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  useInstallationStoreNEK,
  useInstallationStoreWK,
} from "../store/schedule-store";
import { INSTALL_CANDIDATES, type InstallCandidate } from "../data/mock-install-candidates";
import { MONTHLY_INSTALL_GOAL } from "./InstallationCalendar";
import type { ScheduleLine } from "../engine/types";

interface WeekSlot {
  weekStart: Date;
  weekLabel: string;
  wkBilling: number;
  nekBilling: number;
  total: number;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

function lineWeekStart(line: ScheduleLine): Date {
  return startOfWeek(line.startDateTime, { weekStartsOn: 1 });
}

export default function MonthlyPlanView() {
  const wkSchedule = useInstallationStoreWK((s) => s.schedule);
  const nekSchedule = useInstallationStoreNEK((s) => s.schedule);
  const loadWK = useInstallationStoreWK((s) => s.loadWeek);
  const loadNEK = useInstallationStoreNEK((s) => s.loadWeek);

  const [anchorDate] = useState<Date>(new Date());
  const [proposal, setProposal] = useState<AutofillResult | null>(null);

  // Make sure both stores are populated
  useMemo(() => {
    if (wkSchedule.length === 0) void loadWK();
    if (nekSchedule.length === 0) void loadNEK();
  }, [wkSchedule.length, nekSchedule.length, loadWK, loadNEK]);

  const month = useMemo(() => {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    const firstWeek = startOfWeek(start, { weekStartsOn: 1 });
    const slots: WeekSlot[] = [];
    let cursor = firstWeek;
    while (cursor <= end) {
      slots.push({
        weekStart: cursor,
        weekLabel: format(cursor, "MMM d"),
        wkBilling: 0,
        nekBilling: 0,
        total: 0,
      });
      cursor = addWeeks(cursor, 1);
    }
    return { start, end, slots };
  }, [anchorDate]);

  const monthStats = useMemo(() => {
    const slots = month.slots.map((s) => ({ ...s }));
    const addToSlot = (line: ScheduleLine, region: "WK" | "NEK") => {
      const invoice = line.invoiceAmount ?? 0;
      if (invoice <= 0) return;
      if (line.startDateTime < month.start || line.startDateTime > month.end) return;
      const ws = lineWeekStart(line);
      const slot = slots.find(
        (s) => s.weekStart.getTime() === ws.getTime(),
      );
      if (!slot) return;
      if (region === "WK") slot.wkBilling += invoice;
      else slot.nekBilling += invoice;
      slot.total += invoice;
    };
    for (const l of wkSchedule) addToSlot(l, "WK");
    for (const l of nekSchedule) addToSlot(l, "NEK");

    const wkTotal = slots.reduce((s, x) => s + x.wkBilling, 0);
    const nekTotal = slots.reduce((s, x) => s + x.nekBilling, 0);
    const combined = wkTotal + nekTotal;
    return { slots, wkTotal, nekTotal, combined };
  }, [month, wkSchedule, nekSchedule]);

  const gap = Math.max(0, MONTHLY_INSTALL_GOAL - monthStats.combined);
  const goalProgress = monthStats.combined / MONTHLY_INSTALL_GOAL;

  const runAutofill = () => {
    setProposal(
      autofillToGoal(INSTALL_CANDIDATES, gap, month.slots, {
        wkCrewCount: new Set(wkSchedule.map((l) => l.employeeId)).size,
        nekCrewCount: new Set(nekSchedule.map((l) => l.employeeId)).size,
      }),
    );
  };

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
        }}
      >
        <Stat label={`Month of ${format(month.start, "MMMM yyyy")}`} value="" highlight />
        <Stat label="Monthly goal" value={formatMoney(MONTHLY_INSTALL_GOAL)} money />
        <Stat label="Combined" value={formatMoney(monthStats.combined)} money={goalProgress >= 1} warning={goalProgress < 0.9} />
        <Stat label="WK" value={formatMoney(monthStats.wkTotal)} money />
        <Stat label="NEK" value={formatMoney(monthStats.nekTotal)} money />
        <Stat
          label="Progress"
          value={`${Math.round(goalProgress * 100)}%`}
          warning={goalProgress < 0.9}
          money={goalProgress >= 1}
        />
        <Stat label="Gap" value={gap > 0 ? formatMoney(gap) : "✓ on track"} warning={gap > 0} money={gap === 0} />
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={runAutofill}>
          ✨ AI auto-fill to ${MONTHLY_INSTALL_GOAL.toLocaleString()}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${monthStats.slots.length}, 1fr)`,
          gap: 8,
          marginBottom: 16,
        }}
      >
        {monthStats.slots.map((slot) => {
          const weeklyTarget = MONTHLY_INSTALL_GOAL / monthStats.slots.length;
          const onTrack = slot.total >= weeklyTarget * 0.85;
          return (
            <div
              key={slot.weekStart.toISOString()}
              style={{
                padding: 12,
                border: `1px solid ${onTrack ? "rgba(48,108,180,0.4)" : "rgba(232,21,27,0.35)"}`,
                borderRadius: 6,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Week of {slot.weekLabel}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: slot.total > 0 ? "#1b6e3e" : "var(--text-tertiary)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {formatMoney(slot.total)}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                WK {formatMoney(slot.wkBilling)} · NEK {formatMoney(slot.nekBilling)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  height: 6,
                  background: "var(--bg-tertiary)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (slot.total / weeklyTarget) * 100)}%`,
                    background: onTrack ? "#1b6e3e" : "var(--lumineo-red)",
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-tertiary)" }}>
                target {formatMoney(Math.round(weeklyTarget))}
              </div>
            </div>
          );
        })}
      </div>

      {proposal && (
        <AutofillProposal proposal={proposal} onClose={() => setProposal(null)} />
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 13 }}>Install candidate pool</h3>
        <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginBottom: 8 }}>
          Projects either ready for install or close to completing production. The AI
          auto-fill picks from this pool to close the monthly gap.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)" }}>
              <Th>Job</Th>
              <Th>Customer</Th>
              <Th>Region</Th>
              <Th>Status</Th>
              <Th>Promised</Th>
              <Th>Crew</Th>
              <Th align="right">Invoice</Th>
            </tr>
          </thead>
          <tbody>
            {INSTALL_CANDIDATES.map((c) => (
              <tr key={c.jobNo} style={{ borderTop: "1px solid var(--border)" }}>
                <Td>{c.jobNo}</Td>
                <Td>{c.customerName}</Td>
                <Td>{c.region}</Td>
                <Td>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: c.productionStatus === "ready" ? "rgba(74,160,93,0.18)" : "rgba(218,118,18,0.18)",
                      color: c.productionStatus === "ready" ? "#1b5b2b" : "#6f3a05",
                    }}
                  >
                    {c.productionStatus}
                  </span>
                </Td>
                <Td>{format(new Date(c.promisedDate), "MMM d")}</Td>
                <Td>
                  {c.crewPersons}M {c.crewTrucks}T{c.crewLifts ? ` ${c.crewLifts}L` : ""}
                </Td>
                <Td align="right" style={{ color: "#1b6e3e", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {formatMoney(c.invoiceAmount)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function Td({ children, align = "left", style }: { children: React.ReactNode; align?: "left" | "right"; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "6px 8px", textAlign: align, ...style }}>{children}</td>
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
  if (money) color = "#1b6e3e";
  if (warning) color = "#a0420f";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <strong style={{ color, fontSize: 14 }}>{value}</strong>
    </div>
  );
}

// ============================================================
// Auto-fill algorithm
// ============================================================

interface AutofillResult {
  selected: InstallCandidate[];
  rejected: { candidate: InstallCandidate; reason: string }[];
  totalAdded: number;
  remainingGap: number;
}

interface CrewCapacityOpts {
  wkCrewCount: number;
  nekCrewCount: number;
}

function autofillToGoal(
  candidates: InstallCandidate[],
  gap: number,
  weeks: WeekSlot[],
  crew: CrewCapacityOpts,
): AutofillResult {
  if (gap <= 0) {
    return { selected: [], rejected: [], totalAdded: 0, remainingGap: 0 };
  }
  // Greedy by promised-date ascending (urgent first); among same-date,
  // prefer larger invoices to close gap faster.
  const sorted = [...candidates].sort((a, b) => {
    const dateCmp = new Date(a.promisedDate).getTime() - new Date(b.promisedDate).getTime();
    if (dateCmp !== 0) return dateCmp;
    return b.invoiceAmount - a.invoiceAmount;
  });

  const selected: InstallCandidate[] = [];
  const rejected: { candidate: InstallCandidate; reason: string }[] = [];
  let runningTotal = 0;

  // Each week has TWO caps now:
  //   1. $ headroom — keep weeks roughly balanced toward the goal
  //   2. Crew-day headroom per region — can't book more days than crews exist
  const weekDollarHeadroom = weeks.map((w) =>
    Math.max(0, MONTHLY_INSTALL_GOAL / weeks.length - w.total),
  );
  // 5 workdays per week × crew count per region = max crew-days available.
  // Each candidate consumes `ceil(estimatedHours / 8)` crew-days from its region.
  const weekCrewDaysWK = weeks.map(() => 5 * crew.wkCrewCount);
  const weekCrewDaysNEK = weeks.map(() => 5 * crew.nekCrewCount);

  for (const cand of sorted) {
    if (runningTotal >= gap) {
      rejected.push({ candidate: cand, reason: "Gap already closed" });
      continue;
    }
    const crewDaysNeeded = Math.ceil(cand.estimatedHours / 8);
    const regionCap = cand.region === "WK" ? weekCrewDaysWK : weekCrewDaysNEK;

    // Pick the first week with both $ and crew room.
    const weekIdx = weeks.findIndex(
      (_, i) =>
        weekDollarHeadroom[i]! >= cand.invoiceAmount * 0.5 &&
        regionCap[i]! >= crewDaysNeeded,
    );
    if (weekIdx === -1) {
      const reason = regionCap.every((c) => c < crewDaysNeeded)
        ? `No ${cand.region} crew capacity (${crewDaysNeeded} crew-days needed)`
        : "No week has capacity";
      rejected.push({ candidate: cand, reason });
      continue;
    }
    weekDollarHeadroom[weekIdx]! -= cand.invoiceAmount;
    regionCap[weekIdx]! -= crewDaysNeeded;
    selected.push(cand);
    runningTotal += cand.invoiceAmount;
  }

  return {
    selected,
    rejected,
    totalAdded: runningTotal,
    remainingGap: Math.max(0, gap - runningTotal),
  };
}

function AutofillProposal({
  proposal,
  onClose,
}: {
  proposal: AutofillResult;
  onClose: () => void;
}) {
  return (
    <div className="slide-over" onClick={onClose}>
      <div className="slide-over__panel" onClick={(e) => e.stopPropagation()}>
        <div className="section-title">AI auto-fill proposal</div>
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            Selected {proposal.selected.length} candidate{proposal.selected.length === 1 ? "" : "s"},
            adding <strong style={{ color: "#1b6e3e" }}>{formatMoney(proposal.totalAdded)}</strong> toward
            the monthly goal.
            {proposal.remainingGap > 0 ? (
              <> Remaining gap: <strong style={{ color: "var(--lumineo-red)" }}>{formatMoney(proposal.remainingGap)}</strong>.</>
            ) : (
              <> <strong style={{ color: "#1b6e3e" }}>Goal reached.</strong></>
            )}
          </div>

          <h4 style={{ margin: "12px 0 4px", fontSize: 12 }}>Scheduled</h4>
          {proposal.selected.length === 0 && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>None — goal already met.</div>
          )}
          {proposal.selected.map((c) => (
            <div
              key={c.jobNo}
              style={{
                padding: 8,
                marginBottom: 4,
                background: "var(--bg-secondary)",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {c.jobNo} · {c.customerName}{" "}
                <span style={{ color: "#1b6e3e", marginLeft: 4 }}>
                  {formatMoney(c.invoiceAmount)}
                </span>
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                {c.region} · {c.description} · due {format(new Date(c.promisedDate), "MMM d")}
              </div>
            </div>
          ))}

          {proposal.rejected.length > 0 && (
            <>
              <h4 style={{ margin: "16px 0 4px", fontSize: 12 }}>Not scheduled</h4>
              {proposal.rejected.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "2px 0" }}>
                  {r.candidate.jobNo} — {r.reason}
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => {
              alert(
                "Committing would push these onto the install schedule. Wire to dataverseService once the real Power SDK lands — this is a deterministic preview.",
              );
              onClose();
            }}
          >
            Commit proposal
          </button>
        </div>
      </div>
    </div>
  );
}
