import type { Employee, Job, Task } from "../types";

// Al Howell — Hutchinson install crew (truck F96).
// Pulled from WK-Installation/Service Schedule, week of 6/1/2026.
export const CURRENT_EMPLOYEE: Employee = {
  email: "al@lumineosigns.com",
  displayName: "Al Howell",
  bcResourceNo: "AL-OL",
  role: "Employee",
  supervisorEmail: "office@lumineosigns.com",
  supervisorName: "Hutch Office",
};

// Jobs on Al's week schedule (Mon 6/1 – Fri 6/5/2026).
// `customer` is the short label shown next to the job number; `description`
// is the specific work being done on this job.
export const MOCK_JOBS: Job[] = [
  {
    jobNo: "J33723",
    description: "Interior Logo & FCOs",
    customer: "Salina Public Library",
    status: "Install",
    sharePointFolderUrl: "https://lumineosigns.sharepoint.com/Jobs/J33723",
  },
  {
    jobNo: "J29256",
    description: "Building Letters",
    customer: "Salina Fire",
    status: "Install",
  },
  {
    jobNo: "J32429",
    description: "Channel Letters — Freestanding Wall",
    customer: "Capitol Fed (Andover)",
    status: "Install",
  },
  {
    jobNo: "J31228",
    description: "Pan Sign — Building",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J37189",
    description: "Interior Sign",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J31226",
    description: "Monument Face Replacement",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J36515",
    description: "Pole Set",
    customer: "Children's Mercy",
    status: "Install",
  },
  {
    jobNo: "J36516",
    description: "Mow Pads",
    customer: "Children's Mercy",
    status: "Install",
  },
];

// Every job clocks into the same BC task code — 4010 Install Labor.
export const INSTALL_TASK_NO = "4010";
export const INSTALL_TASK_DESCRIPTION = "Install Labor";

export const MOCK_TASKS: Task[] = MOCK_JOBS.map((j) => ({
  jobNo: j.jobNo,
  taskNo: INSTALL_TASK_NO,
  description: INSTALL_TASK_DESCRIPTION,
  estimatedHours: 6,
  remainingHours: 6,
  status: "Open",
}));

export const jobByNo = (jobNo: string) => MOCK_JOBS.find((j) => j.jobNo === jobNo);
export const tasksFor = (jobNo: string) => MOCK_TASKS.filter((t) => t.jobNo === jobNo);
export const taskFor = (jobNo: string, taskNo: string) =>
  MOCK_TASKS.find((t) => t.jobNo === jobNo && t.taskNo === taskNo);

// Display helpers — keep the "J33723 — Salina Public Library" /
// "4010 - Install Labor" formats consistent across the app.
export const jobLabel = (jobNo: string) => {
  const j = jobByNo(jobNo);
  return j ? `${jobNo} — ${j.customer}` : jobNo;
};

export const taskLabel = (jobNo: string, taskNo: string) => {
  const t = taskFor(jobNo, taskNo);
  return t ? `${taskNo} - ${t.description}` : `${taskNo} - ${INSTALL_TASK_DESCRIPTION}`;
};
