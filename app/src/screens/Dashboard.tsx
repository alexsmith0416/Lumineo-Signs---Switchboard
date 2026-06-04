import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { useStore, activePunch } from "../store";
import { useElapsed } from "../hooks/useElapsed";
import { formatElapsed, formatHMShort, formatTime, formatTimeRange, punchDurationMs } from "../lib/format";
import { jobByNo, taskFor } from "../lib/mockData";
import { CURRENT_EMPLOYEE } from "../lib/mockData";
import { CameraIcon, CalendarIcon, CheckCircle, ClockIcon, EditIcon, PlusCircle, RefreshIcon, WifiOffIcon } from "../components/icons";
import { useState } from "react";

export function Dashboard() {
  const navigate = useNavigate();
  const allPunches = useStore((s) => s.punches);
  const isOffline = useStore((s) => s.isOffline);
  const queue = useStore((s) => s.queue);
  const drainQueue = useStore((s) => s.drainQueue);
  const active = useStore(activePunch);
  const clockOut = useStore((s) => s.clockOut);
  const elapsed = useElapsed(active?.clockIn);
  const [modalOpen, setModalOpen] = useState(false);
  const [completedTask, setCompletedTask] = useState(false);

  const now = new Date();
  const today = `${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime(now.toISOString())}`;

  const todayKey = now.toDateString();
  const todayPunches = allPunches.filter(
    (p) => new Date(p.clockIn).toDateString() === todayKey,
  );
  const todayTotalMs = todayPunches.reduce(
    (sum, p) => sum + punchDurationMs(p.clockIn, p.clockOut),
    0,
  );

  const firstName = CURRENT_EMPLOYEE.displayName.split(" ")[0];

  return (
    <>
      <AppHeader />
      <Body>
        {/* Greeting */}
        <div className="bg-white p-3.5 rounded-xl shadow-sm mx-3.5 mt-3">
          <div className="text-base font-extrabold text-navy">Hi, {firstName}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{today}</div>
        </div>

        {/* Offline banner */}
        {isOffline && (
          <div className="bg-[#fff8e1] border border-[#fde68a] rounded-[10px] px-3 py-2.5 flex items-center gap-2.5 mx-3.5 mt-3">
            <div className="w-[30px] h-[30px] rounded-lg bg-[#fde68a] text-[#92400e] flex items-center justify-center shrink-0">
              <WifiOffIcon />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-extrabold text-[#92400e]">You're offline</div>
              <div className="text-[11px] text-[#92400e] mt-0.5">Punches & photos save on this device.</div>
            </div>
            <span className="bg-[#92400e] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0">
              {queue.length} queued
            </span>
          </div>
        )}

        {/* Active punch */}
        {active ? (
          <section className="px-3.5 mt-3.5">
            <SectionLabel>Active Punch</SectionLabel>
            <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-xl p-3.5 shadow-punch-card">
              <div className="flex justify-between items-center gap-2">
                <span className="text-[11px] font-bold opacity-85 tracking-wider">
                  JOB {active.jobNo}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white/[.16] px-2 py-1 rounded-full">
                  <span className="w-[7px] h-[7px] bg-[#22c55e] rounded-full pulse-dot" />
                  {isOffline ? "Clocked In · Local" : "Clocked In"}
                </span>
              </div>
              <div className="text-base font-bold mt-1 leading-tight">
                {jobByNo(active.jobNo)?.description}
              </div>
              <div className="text-xs opacity-85 mt-0.5">Task {active.taskNo} — {jobByNo(active.jobNo) && active.taskNo ? "" : ""}{taskName(active.jobNo, active.taskNo)}</div>
              <div className="text-[26px] font-extrabold tracking-wider mt-2.5 tabular-nums">
                {formatElapsed(elapsed)}
              </div>
              <div className="h-px bg-white/[.16] my-3" />
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <div className="text-[9px] font-bold opacity-75 uppercase tracking-wider">Clock In</div>
                  <div className="text-[13px] font-semibold mt-0.5">{formatTime(active.clockIn)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold opacity-75 uppercase tracking-wider">Sync</div>
                  <div className="text-[13px] font-semibold mt-0.5">{isOffline ? "Pending" : "Local"}</div>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="w-full bg-red hover:bg-red-dark text-white h-11 rounded-[10px] font-bold text-sm flex items-center justify-center gap-2"
              >
                <ClockIcon size={16} className="text-white" />
                {isOffline ? "Clock Out (will sync)" : "Clock Out"}
              </button>
            </div>
          </section>
        ) : null}

        {/* Punch in CTA */}
        <button
          onClick={() => navigate("/punch-in")}
          className="w-[calc(100%-28px)] mx-3.5 mt-3 bg-red hover:bg-red-dark text-white h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2.5 shadow-red-cta"
        >
          <PlusCircle size={22} className="text-white" />
          {active ? "Switch Jobs" : "Punch In to a Job"}
        </button>

        {/* Quick actions */}
        <section className="px-3.5 mt-4">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              to="/capture"
              icon={<CameraIcon className="text-red" />}
              iconBg="bg-red/10"
              label="Upload Photos"
              sub="Survey / Completion"
            />
            <QuickAction
              to="/history"
              icon={<CalendarIcon className="text-navy" />}
              label="Punch History"
              sub="My past punches"
            />
            <QuickAction
              to="/edit-request"
              icon={<EditIcon className="text-navy" />}
              label="Request Edit"
              sub="Fix a past punch"
            />
            <QuickAction
              to="/history"
              icon={<ClockIcon className="text-navy" />}
              label="Today's Total"
              sub={formatHMShort(todayTotalMs)}
            />
          </div>
        </section>

        {/* Queue / sync */}
        {queue.length > 0 && (
          <section className="px-3.5 mt-4">
            <SectionLabel>Waiting to Sync ({queue.length})</SectionLabel>
            <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
              {queue.slice(0, 4).map((q) => (
                <div
                  key={q.id}
                  className="px-3 py-2 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-[11px] font-bold text-navy">
                    {q.kind} · <span className="font-semibold text-gray-700">{q.payloadSummary}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={drainQueue}
              disabled={isOffline}
              className="w-full mt-2.5 h-11 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm flex items-center justify-center gap-2 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshIcon />
              Retry Sync Now
            </button>
          </section>
        )}

        {/* Today's history */}
        <section className="px-3.5 mt-4 pb-4">
          <SectionLabel>Today's History</SectionLabel>
          {todayPunches.filter((p) => p.clockOut !== null).length === 0 ? (
            <div className="bg-white rounded-xl p-5 text-center text-xs text-gray-500 border border-dashed border-gray-200">
              No completed punches today yet.
            </div>
          ) : (
            <div className="bg-white rounded-[10px] border border-gray-200 overflow-hidden">
              {todayPunches
                .filter((p) => p.clockOut !== null)
                .map((p) => (
                  <div
                    key={p.punchId}
                    className="flex justify-between items-center px-3 py-2.5 border-b border-gray-100 last:border-b-0 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-navy">
                        {p.jobNo} · Task {p.taskNo}
                      </div>
                      <div className="text-xs text-gray-700 mt-0.5 truncate">
                        {jobByNo(p.jobNo)?.description}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
                        {formatTimeRange(p.clockIn, p.clockOut)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-navy tabular-nums">
                        {formatHMShort(punchDurationMs(p.clockIn, p.clockOut)).replace(" m", "m").replace(" h ", "h ")}
                      </div>
                      {p.completedTask && (
                        <span className="text-[9px] font-bold bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded-full inline-block mt-1">
                          ✓ Task done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </Body>

      {modalOpen && active && (
        <ClockOutModal
          punchJob={`${active.jobNo} — ${jobByNo(active.jobNo)?.description ?? ""}`}
          punchTask={`Task ${active.taskNo} — ${taskName(active.jobNo, active.taskNo)}`}
          elapsedMs={elapsed}
          clockIn={active.clockIn}
          completedTask={completedTask}
          setCompletedTask={setCompletedTask}
          onCancel={() => setModalOpen(false)}
          onConfirm={() => {
            clockOut(completedTask);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function taskName(jobNo: string, taskNo: string): string {
  return taskFor(jobNo, taskNo)?.description ?? `Task ${taskNo}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
      {children}
    </div>
  );
}

function QuickAction({
  to,
  icon,
  iconBg = "bg-navy-bg",
  label,
  sub,
}: {
  to: string;
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-[10px] px-2.5 py-3 flex flex-col items-start gap-2 min-h-[88px] border border-gray-200 text-left hover:bg-gray-100 transition-colors"
    >
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
      <div>
        <div className="text-xs font-bold text-navy leading-tight">{label}</div>
        <div className="text-[10px] text-gray-500 font-medium mt-0.5">{sub}</div>
      </div>
    </Link>
  );
}

function ClockOutModal({
  punchJob,
  punchTask,
  elapsedMs,
  clockIn,
  completedTask,
  setCompletedTask,
  onCancel,
  onConfirm,
}: {
  punchJob: string;
  punchTask: string;
  elapsedMs: number;
  clockIn: string;
  completedTask: boolean;
  setCompletedTask: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-navy/50 z-40 flex items-end">
      <div className="bg-white rounded-t-2xl w-full p-4 shadow-2xl">
        <div className="text-[17px] font-extrabold text-navy">Clock Out</div>
        <div className="text-xs text-gray-500 mb-3.5">Confirm to end this punch.</div>

        <div className="bg-gray-100 rounded-[10px] p-3 mb-3 space-y-1">
          <Row k="Job" v={punchJob} />
          <Row k="Task" v={punchTask} />
          <Row k="Elapsed" v={formatHMShort(elapsedMs)} />
          <Row k="Clock In" v={formatTime(clockIn)} />
          <Row k="Clock Out" v={formatTime(new Date().toISOString())} />
        </div>

        <label
          className="flex items-start gap-2.5 p-3 bg-label-bg rounded-[10px] mb-3.5 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={completedTask}
            onChange={(e) => setCompletedTask(e.target.checked)}
            className="sr-only"
          />
          <span
            className={`w-[22px] h-[22px] rounded-md border-2 border-navy flex items-center justify-center shrink-0 ${
              completedTask ? "bg-navy" : "bg-white"
            }`}
          >
            {completedTask && <CheckCircle size={12} className="text-white" />}
          </span>
          <span>
            <div className="text-[13px] font-bold text-navy">Completed Current Task</div>
            <div className="text-[11px] text-gray-500 mt-0.5 font-medium">
              Check this if the task is finished. Otherwise it remains open for further work.
            </div>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="h-11 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-11 rounded-[10px] bg-red hover:bg-red-dark text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <ClockIcon size={16} className="text-white" />
            Clock Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-xs py-[3px]">
      <span className="text-gray-500">{k}</span>
      <span className="text-navy font-bold text-right max-w-[60%] truncate">{v}</span>
    </div>
  );
}
