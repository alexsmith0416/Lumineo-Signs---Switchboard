import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  EditRequest,
  HistoryRange,
  Photo,
  Punch,
  QueuedItem,
  SyncStatus,
} from "./types";
import { CURRENT_EMPLOYEE } from "./lib/mockData";
import { taskFor } from "./lib/mockData";

interface AppState {
  // Identity
  currentUserEmail: string;

  // Punches
  punches: Punch[];
  // Photos
  photos: Photo[];
  // Edit requests
  editRequests: EditRequest[];
  // Offline queue
  queue: QueuedItem[];

  // UI state
  isOffline: boolean;
  historyRange: HistoryRange;

  // Toast / banner
  toast: { kind: "success" | "error" | "info"; text: string } | null;

  // ===== Actions =====
  toggleOffline: () => void;
  setHistoryRange: (r: HistoryRange) => void;
  setToast: (t: AppState["toast"]) => void;

  punchIn: (jobNo: string, taskNo: string, completedPrior: boolean) => void;
  clockOut: (completedTask: boolean) => void;

  addPhoto: (
    p: Omit<Photo, "photoId" | "uploaderEmail" | "syncStatus" | "capturedAt"> & {
      capturedAt?: string;
    },
  ) => void;

  submitEditRequest: (
    r: Omit<EditRequest, "requestId" | "createdAt" | "status" | "employeeEmail">,
  ) => void;

  drainQueue: () => void;
  markPunchSync: (punchId: string, status: SyncStatus) => void;
  resetDemoData: () => void;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedPunches(): Punch[] {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const mkTime = (h: number, m: number, dayOffset = 0): string => {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() - dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  return [
    // Today — early morning install at Salina Fire
    {
      punchId: uid("pun"),
      employeeEmail: CURRENT_EMPLOYEE.email,
      jobNo: "J29256",
      taskNo: "40",
      clockIn: mkTime(6, 15),
      clockOut: mkTime(7, 0),
      completedTask: true,
      syncStatus: "Pending",
    },
    // Active punch — clocked in 3h42m ago at Salina Public Library
    (() => {
      const start = new Date(Date.now() - (3 * 3600 + 42 * 60 + 18) * 1000);
      return {
        punchId: uid("pun"),
        employeeEmail: CURRENT_EMPLOYEE.email,
        jobNo: "J33723",
        taskNo: "40",
        clockIn: start.toISOString(),
        clockOut: null,
        completedTask: false,
        syncStatus: "Local" as SyncStatus,
      };
    })(),
    // Yesterday — Capitol Fed (Andover) channel letters, full day
    {
      punchId: uid("pun"),
      employeeEmail: CURRENT_EMPLOYEE.email,
      jobNo: "J32429",
      taskNo: "40",
      clockIn: mkTime(7, 0, 1),
      clockOut: mkTime(12, 30, 1),
      completedTask: false,
      syncStatus: "Pending",
    },
    {
      punchId: uid("pun"),
      employeeEmail: CURRENT_EMPLOYEE.email,
      jobNo: "J32429",
      taskNo: "40",
      clockIn: mkTime(13, 14, 1),
      clockOut: mkTime(17, 32, 1),
      completedTask: true,
      syncStatus: "Pending",
    },
    // 2 days ago — Iron Insurance pan sign install
    {
      punchId: uid("pun"),
      employeeEmail: CURRENT_EMPLOYEE.email,
      jobNo: "J31228",
      taskNo: "40",
      clockIn: mkTime(7, 2, 2),
      clockOut: mkTime(15, 14, 2),
      completedTask: true,
      syncStatus: "Pending",
    },
  ];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserEmail: CURRENT_EMPLOYEE.email,
      punches: seedPunches(),
      photos: [],
      editRequests: [],
      queue: [],
      isOffline: false,
      historyRange: "ThisWeek",
      toast: null,

      toggleOffline: () => set((s) => ({ isOffline: !s.isOffline })),
      setHistoryRange: (historyRange) => set({ historyRange }),
      setToast: (toast) => set({ toast }),

      punchIn: (jobNo, taskNo, completedPrior) => {
        const active = get().punches.find((p) => p.clockOut === null);
        const updates: Partial<AppState> = {};
        const newPunches = [...get().punches];
        if (active) {
          const idx = newPunches.findIndex((p) => p.punchId === active.punchId);
          newPunches[idx] = {
            ...active,
            clockOut: nowIso(),
            completedTask: completedPrior,
            syncStatus: get().isOffline ? "Local" : "Pending",
          };
          if (get().isOffline) {
            updates.queue = [
              ...get().queue,
              {
                id: uid("q"),
                kind: "Punch",
                refId: active.punchId,
                enqueuedAt: nowIso(),
                payloadSummary: `Clock-out · ${active.jobNo} · Task ${active.taskNo}`,
              },
            ];
          }
        }
        const t = taskFor(jobNo, taskNo);
        if (!t) return;
        const newPunch: Punch = {
          punchId: uid("pun"),
          employeeEmail: get().currentUserEmail,
          jobNo,
          taskNo,
          clockIn: nowIso(),
          clockOut: null,
          completedTask: false,
          syncStatus: get().isOffline ? "Local" : "Local",
        };
        newPunches.push(newPunch);
        if (get().isOffline) {
          updates.queue = [
            ...(updates.queue ?? get().queue),
            {
              id: uid("q"),
              kind: "Punch",
              refId: newPunch.punchId,
              enqueuedAt: nowIso(),
              payloadSummary: `Punch-in · ${jobNo} · Task ${taskNo}`,
            },
          ];
        }
        set({ ...updates, punches: newPunches, toast: { kind: "success", text: `Clocked in to ${jobNo} / Task ${taskNo}` } });
      },

      clockOut: (completedTask) => {
        const active = get().punches.find((p) => p.clockOut === null);
        if (!active) return;
        const newPunches = get().punches.map((p) =>
          p.punchId === active.punchId
            ? {
                ...p,
                clockOut: nowIso(),
                completedTask,
                syncStatus: (get().isOffline ? "Local" : "Pending") as SyncStatus,
              }
            : p,
        );
        const updates: Partial<AppState> = { punches: newPunches };
        if (get().isOffline) {
          updates.queue = [
            ...get().queue,
            {
              id: uid("q"),
              kind: "Punch",
              refId: active.punchId,
              enqueuedAt: nowIso(),
              payloadSummary: `Clock-out · ${active.jobNo} · Task ${active.taskNo}`,
            },
          ];
        }
        set({
          ...updates,
          toast: { kind: "success", text: `Clocked out${completedTask ? " · Task complete" : ""}` },
        });
      },

      addPhoto: (input) => {
        const newPhoto: Photo = {
          photoId: uid("pho"),
          jobNo: input.jobNo,
          category: input.category,
          capturedAt: input.capturedAt ?? nowIso(),
          uploaderEmail: get().currentUserEmail,
          dataUrl: input.dataUrl,
          gps: input.gps,
          syncStatus: get().isOffline ? "Local" : "Pending",
          fileSizeKB: input.fileSizeKB,
        };
        const updates: Partial<AppState> = { photos: [newPhoto, ...get().photos] };
        if (get().isOffline) {
          updates.queue = [
            ...get().queue,
            {
              id: uid("q"),
              kind: "Photo",
              refId: newPhoto.photoId,
              enqueuedAt: nowIso(),
              payloadSummary: `Photo · ${input.jobNo} · ${input.category} · ${input.fileSizeKB} KB`,
            },
          ];
        }
        set({ ...updates, toast: { kind: "success", text: "Photo saved" } });
      },

      submitEditRequest: (r) => {
        const newReq: EditRequest = {
          ...r,
          requestId: uid("req"),
          employeeEmail: get().currentUserEmail,
          createdAt: nowIso(),
          status: "Pending",
        };
        const updates: Partial<AppState> = { editRequests: [newReq, ...get().editRequests] };
        if (get().isOffline) {
          updates.queue = [
            ...get().queue,
            {
              id: uid("q"),
              kind: "EditRequest",
              refId: newReq.requestId,
              enqueuedAt: nowIso(),
              payloadSummary: `Edit request · ${r.jobNo} · Task ${r.taskNo}`,
            },
          ];
        }
        set({ ...updates, toast: { kind: "success", text: "Edit request sent to supervisor" } });
      },

      drainQueue: () => {
        if (get().isOffline) {
          set({ toast: { kind: "error", text: "Can't sync while offline" } });
          return;
        }
        const queue = get().queue;
        if (queue.length === 0) {
          set({ toast: { kind: "info", text: "Nothing to sync" } });
          return;
        }
        const newPunches = get().punches.map((p) =>
          p.syncStatus === "Local" && p.clockOut !== null
            ? { ...p, syncStatus: "Pending" as SyncStatus }
            : p,
        );
        const newPhotos = get().photos.map((p) =>
          p.syncStatus === "Local" ? { ...p, syncStatus: "Pending" as SyncStatus } : p,
        );
        set({
          queue: [],
          punches: newPunches,
          photos: newPhotos,
          toast: { kind: "success", text: `Synced ${queue.length} item${queue.length === 1 ? "" : "s"}` },
        });
      },

      markPunchSync: (punchId, status) => {
        set({
          punches: get().punches.map((p) =>
            p.punchId === punchId ? { ...p, syncStatus: status } : p,
          ),
        });
      },

      resetDemoData: () => {
        set({
          punches: seedPunches(),
          photos: [],
          editRequests: [],
          queue: [],
          isOffline: false,
          toast: { kind: "info", text: "Demo data reset" },
        });
      },
    }),
    {
      name: "lumineo-time-photo-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        punches: state.punches,
        photos: state.photos,
        editRequests: state.editRequests,
        queue: state.queue,
        isOffline: state.isOffline,
        historyRange: state.historyRange,
      }),
    },
  ),
);

export function activePunch(state: AppState): Punch | undefined {
  return state.punches.find((p) => p.clockOut === null);
}

export function queuedCount(state: AppState): number {
  return state.queue.length;
}
