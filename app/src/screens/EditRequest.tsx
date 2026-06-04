import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { useStore } from "../store";
import { CURRENT_EMPLOYEE, MOCK_JOBS, tasksFor } from "../lib/mockData";
import { SendIcon } from "../components/icons";

export function EditRequest() {
  const navigate = useNavigate();
  const submit = useStore((s) => s.submitEditRequest);

  const [jobNo, setJobNo] = useState(MOCK_JOBS[0].jobNo);
  const tasks = useMemo(() => tasksFor(jobNo), [jobNo]);
  const [taskNo, setTaskNo] = useState(tasks[0]?.taskNo ?? "");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:14");
  const [reason, setReason] = useState("");

  function handleSubmit() {
    if (!reason.trim()) {
      alert("Please enter a reason for the edit.");
      return;
    }
    const today = new Date();
    const toIso = (hhmm: string): string => {
      const [h, m] = hhmm.split(":").map(Number);
      const d = new Date(today);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    submit({
      jobNo,
      taskNo,
      proposedStart: toIso(start),
      proposedEnd: toIso(end),
      reason,
      supervisorEmail: CURRENT_EMPLOYEE.supervisorEmail,
    });
    navigate("/");
  }

  return (
    <>
      <AppHeader />
      <SubBar title="Request Punch Edit" />
      <Body>
        <section className="px-3.5 pt-3">
          <FormField label="Job">
            <select
              value={jobNo}
              onChange={(e) => {
                setJobNo(e.target.value);
                const next = tasksFor(e.target.value);
                setTaskNo(next[0]?.taskNo ?? "");
              }}
              className="w-full bg-input-bg text-[13px] font-semibold text-navy px-3 py-2.5"
            >
              {MOCK_JOBS.map((j) => (
                <option key={j.jobNo} value={j.jobNo}>
                  {j.jobNo} — {j.customer}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Job Task">
            <select
              value={taskNo}
              onChange={(e) => setTaskNo(e.target.value)}
              className="w-full bg-input-bg text-[13px] font-semibold text-navy px-3 py-2.5"
            >
              {tasks.map((t) => (
                <option key={t.taskNo} value={t.taskNo}>
                  {t.taskNo} - {t.description}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="Start">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full bg-input-bg text-[13px] font-semibold text-navy px-3 py-2.5"
              />
            </FormField>
            <FormField label="End">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full bg-input-bg text-[13px] font-semibold text-navy px-3 py-2.5"
              />
            </FormField>
          </div>

          <FormField label="Reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Forgot to clock out — I left at 3:14 PM but realized the punch was still open this morning."
              rows={4}
              className="w-full bg-input-bg text-[13px] text-navy px-3 py-2.5 placeholder:text-gray-500 placeholder:font-normal resize-none"
            />
          </FormField>

          <FormField label="Notify Supervisor">
            <div className="bg-input-bg text-[13px] font-semibold text-navy px-3 py-2.5 flex items-center gap-2">
              <span className="text-[9px] font-bold bg-navy-bg text-navy px-1.5 py-0.5 rounded uppercase tracking-wider">
                SUP
              </span>
              {CURRENT_EMPLOYEE.supervisorName} — {CURRENT_EMPLOYEE.supervisorEmail}
            </div>
          </FormField>
        </section>

        <section className="px-3.5 mt-1 pb-4">
          <button
            onClick={handleSubmit}
            className="w-full h-[52px] rounded-[10px] bg-red hover:bg-red-dark text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-red-cta"
          >
            <SendIcon size={18} className="text-white" />
            Send Request
          </button>
          <div className="text-center text-[11px] text-gray-500 mt-2.5">
            {CURRENT_EMPLOYEE.supervisorName.split(" ")[0]} will be emailed and notified in-app. Status appears in <strong className="text-navy">My Edit Requests</strong>.
          </div>
        </section>
      </Body>
    </>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="bg-label-bg px-3 py-1.5 text-[11px] font-bold text-navy rounded-t-md uppercase tracking-wider">
        {label}
      </div>
      <div className="border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}
