import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { useStore } from "../store";
import { useMemo } from "react";
import {
  formatHM,
  formatHMShort,
  formatShortDate,
  formatTimeRange,
  punchDurationMs,
} from "../lib/format";
import { formatRangeDates, rangeBounds } from "../lib/range";
import type { HistoryRange } from "../types";
import { jobByNo, jobLabel, taskLabel } from "../lib/mockData";
import { StatusPill } from "../components/StatusPill";
import { EditIcon } from "../components/icons";

const RANGES: { v: HistoryRange; label: string }[] = [
  { v: "Today", label: "Today" },
  { v: "ThisWeek", label: "This Week" },
  { v: "LastWeek", label: "Last Week" },
  { v: "PayPeriod", label: "Pay Period" },
  { v: "Custom", label: "Custom" },
];

export function History() {
  const navigate = useNavigate();
  const punches = useStore((s) => s.punches);
  const range = useStore((s) => s.historyRange);
  const setRange = useStore((s) => s.setHistoryRange);

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const filtered = useMemo(() => {
    return punches.filter((p) => {
      const t = new Date(p.clockIn).getTime();
      return t >= bounds.start.getTime() && t <= bounds.end.getTime();
    });
  }, [punches, bounds]);

  const totalMs = useMemo(
    () => filtered.reduce((sum, p) => sum + punchDurationMs(p.clockIn, p.clockOut), 0),
    [filtered],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const d = new Date(p.clockIn);
      d.setHours(0, 0, 0, 0);
      const k = d.toISOString();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([day, ps]) => ({
        day: new Date(day),
        punches: ps.sort((a, b) =>
          new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime(),
        ),
        totalMs: ps.reduce((s, p) => s + punchDurationMs(p.clockIn, p.clockOut), 0),
      }));
  }, [filtered]);

  const totalDays = grouped.length;

  return (
    <>
      <AppHeader />
      <SubBar title="My Punches" />
      <Body>
        <section className="px-3.5 pt-3">
          <div className="flex gap-1.5 overflow-x-auto scroll-x-hide pb-1">
            {RANGES.map((r) => (
              <button
                key={r.v}
                onClick={() => setRange(r.v)}
                className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-full border ${
                  range === r.v
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>

        {/* Grand total card */}
        <section className="px-3.5 mt-3">
          <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-xl p-3.5 px-4 flex justify-between items-center gap-3 shadow-punch-card">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">
                {bounds.label} Total
              </div>
              <div className="text-xs font-semibold mt-0.5 opacity-95">
                {formatRangeDates(bounds.start, bounds.end)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[26px] font-extrabold tabular-nums tracking-wider leading-none">
                {formatHM(totalMs)}
              </div>
              <div className="text-[10px] font-semibold opacity-85 mt-1">
                {totalDays} day{totalDays === 1 ? "" : "s"} · {filtered.length} punch{filtered.length === 1 ? "" : "es"}
              </div>
            </div>
          </div>
        </section>

        {grouped.length === 0 && (
          <div className="px-3.5 mt-4">
            <div className="bg-white rounded-xl p-5 text-center text-xs text-gray-500 border border-dashed border-gray-200">
              No punches in this range.
            </div>
          </div>
        )}

        {grouped.map((g) => (
          <section key={g.day.toISOString()} className="px-3.5 mt-3">
            <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-3 py-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider flex justify-between items-center">
                <span>{formatShortDate(g.day)}</span>
                <span className="text-navy font-extrabold">{formatHMShort(g.totalMs)}</span>
              </div>
              {g.punches.map((p) => {
                const open = p.clockOut === null;
                return (
                  <div
                    key={p.punchId}
                    className="flex justify-between items-center px-3 py-2.5 border-b border-gray-100 last:border-b-0 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] font-extrabold text-navy truncate">
                        {jobLabel(p.jobNo)}
                      </div>
                      <div className="text-[11px] text-gray-700 mt-0.5 truncate">
                        {jobByNo(p.jobNo)?.description} · {taskLabel(p.jobNo, p.taskNo)}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                        {formatTimeRange(p.clockIn, p.clockOut)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-navy tabular-nums">
                        {formatHM(punchDurationMs(p.clockIn, p.clockOut))}
                      </div>
                      <div className="mt-1">
                        {open ? (
                          <StatusPill variant="Active">Active</StatusPill>
                        ) : p.completedTask ? (
                          <span className="text-[9px] font-bold bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded-full">
                            ✓ Task done
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="px-3.5 mt-4 mb-4 text-center">
          <button
            onClick={() => navigate("/edit-request")}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm border border-gray-200"
          >
            <EditIcon className="text-navy" />
            Request an edit
          </button>
        </div>
      </Body>
    </>
  );
}
