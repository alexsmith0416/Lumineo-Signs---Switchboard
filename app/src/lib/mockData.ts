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
export const MOCK_JOBS: Job[] = [
  {
    jobNo: "J33723",
    description: "Salina Public Library — Interior Logo & FCOs",
    customer: "Salina Public Library",
    status: "Install",
    sharePointFolderUrl: "https://lumineosigns.sharepoint.com/Jobs/J33723",
  },
  {
    jobNo: "J29256",
    description: "Salina Fire — Building Letters",
    customer: "City of Salina Fire Dept",
    status: "Install",
  },
  {
    jobNo: "J32429",
    description: "Capitol Fed (Andover) — Channel Letters",
    customer: "Capitol Federal / City of Andover",
    status: "Install",
  },
  {
    jobNo: "J31228",
    description: "Iron Insurance — Pan Sign (Building)",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J37189",
    description: "Iron Insurance — Interior Sign",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J31226",
    description: "Iron Insurance — Monument Face Replacement",
    customer: "Iron Insurance",
    status: "Install",
  },
  {
    jobNo: "J36515",
    description: "Children's Mercy — Pole Set",
    customer: "Children's Mercy Hospital",
    status: "Install",
  },
  {
    jobNo: "J36516",
    description: "Children's Mercy — Mow Pads",
    customer: "Children's Mercy Hospital",
    status: "Install",
  },
];

// Standard task codes: 10 Survey, 20 Assembly, 30 Paint, 40 Install, 50 Crating.
export const MOCK_TASKS: Task[] = [
  // J33723 — Salina Public Library
  { jobNo: "J33723", taskNo: "10", description: "Survey", estimatedHours: 2, remainingHours: 0, status: "Done" },
  { jobNo: "J33723", taskNo: "20", description: "Assembly", estimatedHours: 8, remainingHours: 0, status: "Done" },
  { jobNo: "J33723", taskNo: "30", description: "Paint", estimatedHours: 6, remainingHours: 0, status: "Done" },
  { jobNo: "J33723", taskNo: "40", description: "Install", estimatedHours: 6, remainingHours: 3.5, status: "Open" },

  // J29256 — Salina Fire
  { jobNo: "J29256", taskNo: "10", description: "Survey", estimatedHours: 1.5, remainingHours: 0, status: "Done" },
  { jobNo: "J29256", taskNo: "20", description: "Assembly", estimatedHours: 6, remainingHours: 0, status: "Done" },
  { jobNo: "J29256", taskNo: "40", description: "Install", estimatedHours: 4, remainingHours: 0, status: "Done" },

  // J32429 — Capitol Fed (Andover)
  { jobNo: "J32429", taskNo: "10", description: "Survey", estimatedHours: 2, remainingHours: 0, status: "Done" },
  { jobNo: "J32429", taskNo: "20", description: "Assembly", estimatedHours: 10, remainingHours: 0, status: "Done" },
  { jobNo: "J32429", taskNo: "30", description: "Paint", estimatedHours: 5, remainingHours: 0, status: "Done" },
  { jobNo: "J32429", taskNo: "40", description: "Install", estimatedHours: 8, remainingHours: 0, status: "Done" },

  // J31228 — Iron Insurance pan sign
  { jobNo: "J31228", taskNo: "10", description: "Survey", estimatedHours: 1.5, remainingHours: 0, status: "Done" },
  { jobNo: "J31228", taskNo: "20", description: "Assembly", estimatedHours: 7, remainingHours: 0, status: "Done" },
  { jobNo: "J31228", taskNo: "30", description: "Paint", estimatedHours: 4, remainingHours: 0, status: "Done" },
  { jobNo: "J31228", taskNo: "40", description: "Install", estimatedHours: 5, remainingHours: 0, status: "Done" },

  // J37189 — Iron Insurance interior sign
  { jobNo: "J37189", taskNo: "20", description: "Assembly", estimatedHours: 5, remainingHours: 0, status: "Done" },
  { jobNo: "J37189", taskNo: "40", description: "Install", estimatedHours: 3, remainingHours: 0, status: "Done" },

  // J31226 — Iron Insurance monument face replacement
  { jobNo: "J31226", taskNo: "20", description: "Fabrication", estimatedHours: 4, remainingHours: 0, status: "Done" },
  { jobNo: "J31226", taskNo: "40", description: "Install", estimatedHours: 3, remainingHours: 3, status: "Open" },

  // J36515 — Children's Mercy pole set
  { jobNo: "J36515", taskNo: "10", description: "Survey", estimatedHours: 2, remainingHours: 0, status: "Done" },
  { jobNo: "J36515", taskNo: "40", description: "Install", estimatedHours: 6, remainingHours: 6, status: "Open" },

  // J36516 — Children's Mercy mow pads
  { jobNo: "J36516", taskNo: "40", description: "Install", estimatedHours: 4, remainingHours: 4, status: "Open" },
];

export const jobByNo = (jobNo: string) => MOCK_JOBS.find((j) => j.jobNo === jobNo);
export const tasksFor = (jobNo: string) => MOCK_TASKS.filter((t) => t.jobNo === jobNo);
export const taskFor = (jobNo: string, taskNo: string) =>
  MOCK_TASKS.find((t) => t.jobNo === jobNo && t.taskNo === taskNo);
