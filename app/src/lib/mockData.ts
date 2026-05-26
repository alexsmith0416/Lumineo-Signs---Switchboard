import type { Employee, Job, Task } from "../types";

export const CURRENT_EMPLOYEE: Employee = {
  email: "mike@lumineosigns.com",
  displayName: "Mike Reyes",
  bcResourceNo: "MIKE-OL",
  role: "Employee",
  supervisorEmail: "sarah@lumineosigns.com",
  supervisorName: "Sarah Chen",
};

export const MOCK_JOBS: Job[] = [
  {
    jobNo: "24-1187",
    description: "Riverstone Plaza — Main Pylon",
    customer: "Riverstone Properties",
    status: "Paint",
    sharePointFolderUrl: "https://lumineosigns.sharepoint.com/Jobs/24-1187",
  },
  {
    jobNo: "24-0942",
    description: "Lakeside Dental — Monument",
    customer: "Lakeside Dental Group",
    status: "Assembly",
  },
  {
    jobNo: "24-1024",
    description: "Northgate Mall — Install Banner",
    customer: "Northgate Property Co.",
    status: "Install",
  },
  {
    jobNo: "24-1201",
    description: "Beachfront Tacos — Channel Letters",
    customer: "Beachfront Hospitality",
    status: "Survey",
  },
  {
    jobNo: "24-0888",
    description: "Hillview High — Stadium Signage",
    customer: "Hillview USD",
    status: "Paint",
  },
];

export const MOCK_TASKS: Task[] = [
  // 24-1187
  { jobNo: "24-1187", taskNo: "10", description: "Survey", estimatedHours: 2, remainingHours: 0, status: "Done" },
  { jobNo: "24-1187", taskNo: "20", description: "Assembly", estimatedHours: 8, remainingHours: 0, status: "Done" },
  { jobNo: "24-1187", taskNo: "30", description: "Paint", estimatedHours: 7.5, remainingHours: 5.5, status: "Open" },
  { jobNo: "24-1187", taskNo: "40", description: "Install", estimatedHours: 6, remainingHours: 6, status: "Open" },
  // 24-0942
  { jobNo: "24-0942", taskNo: "20", description: "Assembly", estimatedHours: 6, remainingHours: 2.5, status: "Open" },
  { jobNo: "24-0942", taskNo: "30", description: "Paint", estimatedHours: 5, remainingHours: 5, status: "Open" },
  { jobNo: "24-0942", taskNo: "50", description: "Crating", estimatedHours: 1, remainingHours: 0.25, status: "Open" },
  // 24-1024
  { jobNo: "24-1024", taskNo: "40", description: "Install", estimatedHours: 8, remainingHours: 1.5, status: "Open" },
  // 24-1201
  { jobNo: "24-1201", taskNo: "10", description: "Survey", estimatedHours: 3, remainingHours: 3, status: "Open" },
  // 24-0888
  { jobNo: "24-0888", taskNo: "20", description: "Assembly", estimatedHours: 12, remainingHours: 8, status: "Open" },
  { jobNo: "24-0888", taskNo: "30", description: "Paint", estimatedHours: 10, remainingHours: 10, status: "Open" },
];

export const jobByNo = (jobNo: string) => MOCK_JOBS.find((j) => j.jobNo === jobNo);
export const tasksFor = (jobNo: string) => MOCK_TASKS.filter((t) => t.jobNo === jobNo);
export const taskFor = (jobNo: string, taskNo: string) =>
  MOCK_TASKS.find((t) => t.jobNo === jobNo && t.taskNo === taskNo);
