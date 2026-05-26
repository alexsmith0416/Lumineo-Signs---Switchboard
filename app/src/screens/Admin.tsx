import { useMemo, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { useStore } from "../store";
import { jobByNo } from "../lib/mockData";
import {
  formatHM,
  formatTime,
  punchDurationMs,
} from "../lib/format";
import { StatusPill } from "../components/StatusPill";
import { Check, DownloadIcon } from "../components/icons";
import { CURRENT_EMPLOYEE } from "../lib/mockData";
import type { SyncStatus } from "../types";

type Filter = "All" | SyncStatus;
const FILTERS: Filter[] = ["All", "Pending", "Approved", "Posted", "Failed"];

export function Admin() {
  const punches = useStore((s) => s.punches);
  const markPunchSync = useStore((s) => s.markPunchSync);
  const setToast = useStore((s) => s.setToast);

  const [filter, setFilter] = useState<Filter>("Pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const closed = useMemo(
    () => punches.filter((p) => p.clockOut !== null),
    [punches],
  );
  const filtered = useMemo(
    () => (filter === "All" ? closed : closed.filter((p) => p.syncStatus === filter)),
    [closed, filter],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      All: closed.length,
      Local: 0,
      Pending: 0,
      Approved: 0,
      Posted: 0,
      Failed: 0,
    };
    for (const p of closed) c[p.syncStatus] += 1;
    return c;
  }, [closed]);

  function toggle(punchId: string) {
    const next = new Set(selected);
    if (next.has(punchId)) next.delete(punchId);
    else next.add(punchId);
    setSelected(next);
  }

  function markApproved() {
    if (selected.size === 0) {
      setToast({ kind: "info", text: "Select rows to approve" });
      return;
    }
    selected.forEach((id) => markPunchSync(id, "Approved"));
    setToast({ kind: "success", text: `Approved ${selected.size} punch${selected.size === 1 ? "" : "es"}` });
    setSelected(new Set());
  }

  function exportCsv() {
    const rows = (selected.size > 0 ? closed.filter((p) => selected.has(p.punchId)) : filtered);
    const header = [
      "PunchId",
      "Employee",
      "BCResourceNo",
      "JobNo",
      "TaskNo",
      "ClockIn",
      "ClockOut",
      "DurationHours",
      "CompletedTask",
      "SyncStatus",
    ].join(",");
    const lines = rows.map((p) =>
      [
        p.punchId,
        p.employeeEmail,
        CURRENT_EMPLOYEE.bcResourceNo,
        p.jobNo,
        p.taskNo,
        p.clockIn,
        p.clockOut ?? "",
        (punchDurationMs(p.clockIn, p.clockOut) / 3_600_000).toFixed(2),
        p.completedTask ? "Y" : "N",
        p.syncStatus,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumineo-punches-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast({ kind: "success", text: `Exported ${rows.length} row${rows.length === 1 ? "" : "s"}` });
  }

  return (
    <>
      <AppHeader subtitle="TIME & PHOTO" adminBadge />
      <SubBar title="Pending Punches" />
      <Body>
        <section className="px-3.5 pt-3">
          <div className="flex gap-1.5 overflow-x-auto scroll-x-hide pb-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-full border flex items-center gap-1.5 ${
                  filter === f
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {f}
                <span
                  className={`text-[10px] font-bold ${
                    filter === f ? "text-white/80" : "text-navy"
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="px-3.5 mt-3">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
            {filter} · {filtered.length} row{filtered.length === 1 ? "" : "s"}
            {selected.size > 0 && (
              <span className="ml-2 text-navy">· {selected.size} selected</span>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center text-xs text-gray-500 border border-dashed border-gray-200">
              No punches match this filter.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((p) => (
                <button
                  key={p.punchId}
                  onClick={() => toggle(p.punchId)}
                  className={`text-left bg-white rounded-[10px] p-3 flex justify-between gap-2 border ${
                    selected.has(p.punchId) ? "border-navy ring-2 ring-navy/10" : "border-gray-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-[18px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0 ${
                          selected.has(p.punchId) ? "bg-navy" : "bg-white border border-gray-300"
                        }`}
                      >
                        {selected.has(p.punchId) && <Check className="text-white" size={12} />}
                      </span>
                      <div className="text-[11px] font-bold text-navy">
                        {CURRENT_EMPLOYEE.bcResourceNo} · {p.jobNo} / Task {p.taskNo}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 mt-1 truncate">
                      {jobByNo(p.jobNo)?.description}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
                      {formatTime(p.clockIn)} → {p.clockOut ? formatTime(p.clockOut) : "—"} ·{" "}
                      {formatHM(punchDurationMs(p.clockIn, p.clockOut))}{" "}
                      {p.completedTask ? " · ✓ Task complete" : ""}
                    </div>
                  </div>
                  <StatusPill variant={p.syncStatus === "Pending" ? "Pending" : p.syncStatus === "Approved" || p.syncStatus === "Posted" ? "Synced" : "Pending"}>
                    {p.syncStatus}
                  </StatusPill>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="px-3.5 mt-3 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={markApproved}
              className="h-[52px] rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm border border-gray-200 flex items-center justify-center gap-2"
            >
              <Check className="text-navy" size={18} />
              Mark Approved
            </button>
            <button
              onClick={exportCsv}
              className="h-[52px] rounded-[10px] bg-navy hover:bg-navy-light text-white font-bold text-sm flex items-center justify-center gap-2"
            >
              <DownloadIcon className="text-white" />
              Export CSV
            </button>
          </div>
          <div className="text-center text-[11px] text-gray-500 mt-2.5">
            Interim until Phase 4 BC write-back is approved.
          </div>
        </section>
      </Body>
    </>
  );
}
