import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { jobByNo, MOCK_JOBS, tasksFor } from "../lib/mockData";
import { activePunch, useStore } from "../store";
import { useMemo, useState } from "react";
import { AlertIcon, Check, CheckCircle } from "../components/icons";

export function PunchIn() {
  const navigate = useNavigate();
  const active = useStore(activePunch);
  const punchIn = useStore((s) => s.punchIn);

  const [selectedJob, setSelectedJob] = useState<string>("24-1187");
  const [selectedTask, setSelectedTask] = useState<string>("30");
  const [completedPrior, setCompletedPrior] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_JOBS;
    return MOCK_JOBS.filter(
      (j) =>
        j.jobNo.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const tasks = useMemo(() => tasksFor(selectedJob), [selectedJob]);
  const jobObj = jobByNo(selectedJob);
  const taskObj = tasks.find((t) => t.taskNo === selectedTask);

  const switchingFrom =
    active && active.jobNo !== selectedJob ? active : undefined;

  function handleStart() {
    if (!taskObj) return;
    punchIn(selectedJob, selectedTask, completedPrior);
    navigate("/");
  }

  return (
    <>
      <AppHeader />
      <SubBar title="Punch In" />
      <Body>
        <section className="px-3.5 pt-3">
          <SectionLabel>Job → Task</SectionLabel>

          {/* Step 1: Job */}
          <StepCard
            n="1"
            title="Job"
            status={jobObj ? "Selected" : "Choose one"}
            done={!!jobObj}
            active={!jobObj}
          >
            {jobObj ? (
              <button
                onClick={() => setSearchQuery(" ")}
                className="w-full"
              >
                <SelectedPill kKey={`JOB ${jobObj.jobNo}`} v={jobObj.description} />
              </button>
            ) : null}

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs by # or name…"
              className="w-full bg-input-bg border border-gray-200 rounded-lg px-3 py-2 text-sm mt-2 placeholder:text-gray-500"
            />

            {searchQuery.trim() !== "" && (
              <div className="flex flex-col gap-1.5 mt-2 max-h-56 overflow-y-auto scroll-area">
                {filteredJobs.map((j) => (
                  <button
                    key={j.jobNo}
                    onClick={() => {
                      setSelectedJob(j.jobNo);
                      const newTasks = tasksFor(j.jobNo);
                      setSelectedTask(newTasks.find((t) => t.status === "Open")?.taskNo ?? "");
                      setSearchQuery("");
                    }}
                    className={`text-left px-3 py-2 rounded-lg border ${
                      selectedJob === j.jobNo
                        ? "bg-navy text-white border-navy"
                        : "bg-input-bg border-gray-200 text-navy hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-[11px] font-bold tracking-wider uppercase opacity-80">
                      JOB {j.jobNo}
                    </div>
                    <div className="text-sm font-bold mt-0.5">{j.description}</div>
                    <div className="text-[11px] opacity-75 mt-0.5">{j.customer}</div>
                  </button>
                ))}
              </div>
            )}
          </StepCard>

          {/* Step 2: Task */}
          <StepCard
            n="2"
            title="Task"
            status={taskObj ? "Selected" : "Choose one"}
            done={!!taskObj}
            active={!!jobObj && !taskObj}
          >
            <div className="flex flex-col gap-1.5">
              {tasks.map((t) => (
                <button
                  key={t.taskNo}
                  onClick={() => setSelectedTask(t.taskNo)}
                  disabled={t.status === "Done"}
                  className={`flex justify-between items-center px-3 py-2.5 rounded-lg border text-left ${
                    selectedTask === t.taskNo
                      ? "bg-navy text-white border-navy"
                      : "bg-input-bg border-gray-200 hover:bg-gray-100"
                  } ${t.status === "Done" ? "opacity-60" : ""}`}
                >
                  <div>
                    <div className={`text-[13px] font-semibold ${selectedTask === t.taskNo ? "text-white" : "text-navy"}`}>
                      Task {t.taskNo} · {t.description}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${selectedTask === t.taskNo ? "text-white/80" : "text-gray-500"}`}>
                      Est. {t.estimatedHours} h · Remaining {t.remainingHours} h
                    </div>
                  </div>
                  <div className={`text-[11px] font-bold ${selectedTask === t.taskNo ? "text-white" : "text-gray-700"}`}>
                    {t.status === "Done" ? "Done" : `${t.remainingHours} h`}
                  </div>
                </button>
              ))}
            </div>
          </StepCard>

          {/* Switch-job warning */}
          {switchingFrom && (
            <div className="bg-[#fff8e1] border border-[#fde68a] px-3 py-2.5 rounded-[10px] mt-2.5 flex gap-2.5">
              <AlertIcon className="text-[#92400e] shrink-0 mt-0.5" size={18} />
              <div>
                <div className="text-xs font-bold text-[#92400e]">
                  You're currently clocked into Job {switchingFrom.jobNo}
                </div>
                <div className="text-[11px] text-[#92400e] mt-0.5">
                  Punching in here will clock you out automatically.
                </div>
                <label className="flex gap-1.5 items-center mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={completedPrior}
                    onChange={(e) => setCompletedPrior(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-[18px] h-[18px] rounded-[4px] flex items-center justify-center ${
                      completedPrior ? "bg-[#92400e]" : "bg-white border border-[#92400e]"
                    }`}
                  >
                    {completedPrior && <Check size={12} className="text-white" />}
                  </span>
                  <span className="text-xs font-bold text-[#92400e]">
                    Completed Task {switchingFrom.taskNo} on previous job
                  </span>
                </label>
              </div>
            </div>
          )}

          <button
            disabled={!taskObj}
            onClick={handleStart}
            className="w-full mt-3.5 h-[52px] rounded-[10px] bg-red hover:bg-red-dark text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-red-cta disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={20} className="text-white" />
            Start Punch — {selectedJob} / Task {selectedTask || "?"}
          </button>
          <div className="text-center text-[11px] text-gray-500 mt-2 pb-4">
            Auto clock-out at 8:00 PM if you forget
          </div>
        </section>
      </Body>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
      {children}
    </div>
  );
}

function StepCard({
  n,
  title,
  status,
  done,
  active,
  children,
}: {
  n: string;
  title: string;
  status: string;
  done?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-[10px] border border-gray-200 mb-2 ${
        active ? "ring-2 ring-navy/10 border-navy" : ""
      } ${done ? "" : ""}`}
    >
      <div className={`flex justify-between items-center px-3 py-2.5 border-b border-gray-100 ${done ? "bg-[#ecfdf5]" : ""}`}>
        <div className="flex items-center">
          <span
            className={`w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[11px] font-extrabold mr-2 ${
              done ? "bg-[#22c55e] text-white" : "bg-navy-bg text-navy"
            }`}
          >
            {done ? "✓" : n}
          </span>
          <span className="text-[13px] font-bold text-navy">{title}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${done ? "text-[#16a34a]" : "text-gray-500"}`}>
          {status}
        </span>
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

function SelectedPill({ kKey, v }: { kKey: string; v: string }) {
  return (
    <span className="inline-flex flex-col bg-input-bg px-3 py-2 rounded-lg border border-gray-200 text-left">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{kKey}</span>
      <span className="text-[13px] font-bold text-navy mt-0.5">{v}</span>
    </span>
  );
}
