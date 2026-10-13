import { create } from "zustand";
import {
  SYNC_POLL_MS, SYNC_PULLS, overallPhase, readSyncRequest, type SyncKind, type SyncPhase,
} from "../services/sync-request";
import { useJobTrackingStore } from "./job-tracking-store";
import { useJobScheduleStore } from "./job-schedule-store";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { usePoReceivingStore } from "./po-receiving-store";

/**
 * "Check BC now" on the Jobs list (Oct 12, 2026): asks every BC pull to run
 * right away (shop-floor & install ticks, new orders, descriptions, POs —
 * not sketches, Oct 13: too slow) instead of at its next scheduled time, watches each request, and
 * as each finishes reloads what it changed — new ticks are also applied at
 * once in a session that applies them. Keeps watching if you leave the Jobs
 * list. Pressing it again only re-asks the pulls that have finished.
 * Dev: pretends (mock data).
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const dv = () => import("../services/dataverse-live");

export type BcCheckPhase = "idle" | SyncPhase;

export interface PullState {
  phase: SyncPhase;
  message: string;
}

interface BcCheckState {
  /** Each pull's state in this check (missing = not asked). */
  pulls: Partial<Record<SyncKind, PullState>>;
  /** The check as a whole. */
  phase: BcCheckPhase;
  /** Ask every pull that isn't already busy; resolves when they've all finished. */
  check: (requestedBy: string) => Promise<void>;
  dismiss: () => void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const busy = (p?: PullState) => p?.phase === "waiting" || p?.phase === "running";

/** After a pull finished: reload what it changed. Returns a note for its line, if any. */
async function afterPull(kind: SyncKind): Promise<string> {
  switch (kind) {
    case "taskcompletions": {
      const m = await import("./task-completion-processor");
      const applied = await m.applyTicksNow();
      await Promise.all([useJobTrackingStore.getState().load(true), useJobDeptCompletionStore.getState().load(true)]);
      if (applied === null) return "an Admin / Ops session applies them within 2 minutes";
      return applied ? `${applied} applied` : "";
    }
    case "neworders":
      await Promise.all([useJobTrackingStore.getState().load(true), useJobScheduleStore.getState().load(true)]);
      return "";
    case "jobdescriptions":
      (await import("../hooks/useJobDescriptions")).clearJobDescriptionsCache();
      return "";
    case "jobpos":
      (await import("../hooks/useJobPOs")).clearJobPOsCache();
      await usePoReceivingStore.getState().load(true);
      return "";
    default:
      return ""; // jobsketches: never asked by the button (scheduler only)
  }
}

const hasNews = (message: string) => !/^(no |.*up to date)/i.test(message);

export const useBcCheckStore = create<BcCheckState>((set, get) => {
  const setPull = (kind: SyncKind, p: PullState) => {
    const pulls = { ...get().pulls, [kind]: p };
    set({ pulls, phase: overallPhase(Object.values(pulls).map((x) => x!.phase)) });
  };

  /** One pull: ask, watch, reload. */
  async function runPull(kind: SyncKind, requestedBy: string): Promise<void> {
    setPull(kind, { phase: "waiting", message: "Asking…" });
    let id: string;
    try {
      id = await (await dv()).createSyncRequest(kind, requestedBy);
    } catch (e) {
      setPull(kind, { phase: "failed", message: `Couldn't ask: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    const started = Date.now();
    for (;;) {
      await wait(SYNC_POLL_MS);
      let row: { status: string; result: string } | null;
      try {
        row = await (await dv()).fetchSyncRequest(id);
      } catch {
        continue; // a read blip — try again next tick
      }
      const v = readSyncRequest(kind, row, Date.now() - started);
      if (v.phase === "done") {
        // Still "running" on screen while the app reloads / applies.
        setPull(kind, { phase: "running", message: v.message });
        let note = "";
        try {
          if (hasNews(v.message)) note = await afterPull(kind);
        } catch (e) {
          note = `couldn't reload: ${e instanceof Error ? e.message : String(e)}`;
        }
        setPull(kind, { phase: "done", message: note ? `${v.message} — ${note}` : v.message });
        return;
      }
      setPull(kind, v);
      if (v.phase === "failed") return;
    }
  }

  return {
    pulls: {},
    phase: "idle",

    check: async (requestedBy) => {
      const current = get().pulls;
      const ask = SYNC_PULLS.map((p) => p.kind).filter((k) => !busy(current[k]));
      if (!ask.length) return;
      // A new check starts a fresh list; pulls still going stay on it.
      const keep = Object.fromEntries(Object.entries(current).filter(([, p]) => busy(p)));
      set({ pulls: keep });
      if (!LIVE) {
        for (const k of ask) setPull(k, { phase: "running", message: "Checking…" });
        await wait(800);
        for (const k of ask) setPull(k, { phase: "done", message: "Dev mode — BC isn't checked with mock data." });
        return;
      }
      await Promise.all(ask.map((k) => runPull(k, requestedBy)));
    },

    dismiss: () => {
      if (get().phase === "done" || get().phase === "failed") set({ pulls: {}, phase: "idle" });
    },
  };
});
