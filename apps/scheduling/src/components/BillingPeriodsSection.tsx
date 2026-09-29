import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useBillingPeriodStore } from "../store/billing-period-store";
import {
  billingPeriod,
  cutoffProblem,
  DEFAULT_MONTHLY_GOAL,
  monthsAround,
  type BillingPeriodRow,
} from "../services/billing-periods";

/**
 * Settings → Billing periods. Each month's billing CUT-OFF date and goal, which
 * set the "Billing · month" stat on the Installation board and the Monthly Plan.
 * A job counts toward the month its install ENDS in; the cut-off day itself
 * rolls to the next month. Admin / Developer / Ops only (the caller gates it).
 */
export default function BillingPeriodsSection() {
  const rows = useBillingPeriodStore((s) => s.rows);
  const load = useBillingPeriodStore((s) => s.load);
  const setPeriod = useBillingPeriodStore((s) => s.setPeriod);
  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => monthsAround(new Date()), []);

  return (
    <div className="settings-section">
      <div className="settings-section__title">Billing periods</div>
      <div className="settings-row__desc">
        Set each month's <strong>billing cut-off date</strong>. A job counts toward the month its install{" "}
        <strong>ends</strong> in, and an install has to end the <strong>day before</strong> the cut-off to be turned
        in that month — an install ending <em>on</em> the cut-off day counts toward the next month. A month with no
        cut-off runs 1st to last day. The goal defaults to {money(DEFAULT_MONTHLY_GOAL)}.
      </div>
      <table className="billing-periods">
        <thead>
          <tr>
            <th>Month</th>
            <th>Cut-off date</th>
            <th>Installs ending</th>
            <th>Goal</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <PeriodRow key={m} month={m} rows={rows} onSave={(patch) => void setPeriod(m, patch)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodRow({
  month,
  rows,
  onSave,
}: {
  month: string;
  rows: BillingPeriodRow[];
  onSave: (patch: Partial<Omit<BillingPeriodRow, "month">>) => void;
}) {
  const row = rows.find((r) => r.month === month);
  const p = billingPeriod(month, rows);
  const [cutoff, setCutoff] = useState(row?.cutoff ?? "");
  const [goal, setGoal] = useState(row?.goal != null ? money(row.goal) : "");
  const [problem, setProblem] = useState<string | null>(null);
  // Follow the store when it loads or another save lands.
  useEffect(() => setCutoff(row?.cutoff ?? ""), [row?.cutoff]);
  useEffect(() => setGoal(row?.goal != null ? money(row.goal) : ""), [row?.goal]);

  const saveCutoff = (value: string) => {
    setCutoff(value);
    if (!value) {
      setProblem(null);
      if (row?.cutoff) onSave({ cutoff: null });
      return;
    }
    const why = cutoffProblem(month, value, rows);
    setProblem(why);
    if (!why && value !== row?.cutoff) onSave({ cutoff: value });
  };

  const saveGoal = () => {
    const trimmed = goal.replace(/[$,\s]/g, "");
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) return setGoal(row?.goal != null ? money(row.goal) : "");
    if (next !== (row?.goal ?? null)) onSave({ goal: next });
    else setGoal(next != null ? money(next) : "");
  };

  return (
    <tr>
      <td className="billing-periods__month">{format(monthDate(month), "MMMM yyyy")}</td>
      <td>
        <input
          type="date"
          value={cutoff}
          aria-label={`Billing cut-off for ${month}`}
          onChange={(e) => saveCutoff(e.target.value)}
        />
        {problem && <div className="billing-periods__problem">{problem}</div>}
      </td>
      <td className={p.cutoffSet ? "" : "billing-periods__default"}>
        {format(p.start, "MMM d")} – {format(p.lastInstallDay, "MMM d")}
        {!p.cutoffSet && " (no cut-off set)"}
      </td>
      <td>
        <input
          type="text"
          inputMode="numeric"
          value={goal}
          placeholder={money(DEFAULT_MONTHLY_GOAL)}
          aria-label={`Billing goal for ${month}`}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={saveGoal}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </td>
    </tr>
  );
}

const monthDate = (month: string): Date => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1);
};

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;
