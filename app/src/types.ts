export type TaskStatus = "Open" | "Done";
export type JobStatus =
  | "Survey"
  | "Paint"
  | "Assembly"
  | "Install"
  | "Complete";
export type PhotoCategory = "Survey" | "Completion";
export type SyncStatus =
  | "Local"
  | "Pending"
  | "Approved"
  | "Posted"
  | "Failed";
export type QueueKind = "Punch" | "Photo" | "EditRequest";

export interface Job {
  jobNo: string;
  description: string;
  customer: string;
  status: JobStatus;
  sharePointFolderUrl?: string;
}

export interface Task {
  jobNo: string;
  taskNo: string;
  description: string;
  estimatedHours: number;
  remainingHours: number;
  status: TaskStatus;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Punch {
  punchId: string;
  employeeEmail: string;
  jobNo: string;
  taskNo: string;
  clockIn: string; // ISO
  clockOut: string | null; // ISO or null
  completedTask: boolean;
  gpsIn?: GeoPoint;
  gpsOut?: GeoPoint;
  syncStatus: SyncStatus;
}

export interface Photo {
  photoId: string;
  jobNo: string;
  category: PhotoCategory;
  capturedAt: string; // ISO
  uploaderEmail: string;
  dataUrl: string; // base64 (prototype only)
  gps?: GeoPoint;
  syncStatus: SyncStatus;
  fileSizeKB: number;
}

export interface EditRequest {
  requestId: string;
  punchId?: string;
  employeeEmail: string;
  jobNo: string;
  taskNo: string;
  proposedStart: string;
  proposedEnd: string;
  reason: string;
  supervisorEmail: string;
  status: "Pending" | "Approved" | "Denied";
  createdAt: string;
}

export interface QueuedItem {
  id: string;
  kind: QueueKind;
  refId: string;
  enqueuedAt: string;
  payloadSummary: string;
}

export interface Employee {
  email: string;
  displayName: string;
  bcResourceNo: string;
  role: "Employee" | "Supervisor" | "Admin";
  supervisorEmail: string;
  supervisorName: string;
}

export type HistoryRange =
  | "Today"
  | "ThisWeek"
  | "LastWeek"
  | "PayPeriod"
  | "Custom";
