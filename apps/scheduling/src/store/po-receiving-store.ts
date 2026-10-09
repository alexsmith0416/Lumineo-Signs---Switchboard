import { useEffect } from "react";
import { create } from "zustand";
import { persistOrReport } from "./write-status-store";
import {
  jobPoSummary,
  statusAfterDelivery,
  vendorStatusOf,
  type JobPoSummary,
  type PoDelivery,
  type PoReceipt,
  type WarehousePO,
} from "../services/po-receiving";

/**
 * Warehouse Management (Oct 8, 2026): every job PO from BC (crfdf_jobpo) with
 * its receiving — Vendor Status (crfdf_poreceipt) and deliveries
 * (crfdf_podelivery) — shared by the Warehouse page, the Jobs list's POs
 * column, the job panels and the cards. Loaded once; Refresh re-reads.
 * Edits are optimistic: a failed save keeps the edit on screen and is
 * reported (write-status-store). When a receipt makes a job MATERIALS READY
 * (every non-archived PO Received), BC's Job Purchasing step is completed.
 * Dev: synthetic POs (data/mock-pos.ts), in memory.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";
const dv = () => import("../services/dataverse-live");
const newId = () => crypto.randomUUID();

interface PoReceivingState {
  pos: WarehousePO[];
  receipts: Map<string, PoReceipt>;
  deliveries: Map<string, PoDelivery[]>;
  loaded: boolean;
  loading: boolean;
  error: string;
  /** When the POs were last read. */
  loadedAt: Date | null;
  load: (force?: boolean) => Promise<void>;
  /** Set a PO's Vendor Status (Admin / Ops). */
  setStatus: (po: WarehousePO, status: string, by: string) => Promise<void>;
  /** Record a delivery; `final` = the last one (the PO is Received). */
  receive: (
    po: WarehousePO,
    d: { date: string; site: string; location: string; notes: string; final: boolean },
    by: string,
  ) => Promise<void>;
  updateDelivery: (d: PoDelivery) => Promise<void>;
  removeDelivery: (d: PoDelivery) => Promise<void>;
}

export const usePoReceivingStore = create<PoReceivingState>((set, get) => ({
  pos: [],
  receipts: new Map(),
  deliveries: new Map(),
  loaded: false,
  loading: false,
  error: "",
  loadedAt: null,

  load: async (force = false) => {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true, error: "" });
    try {
      if (!LIVE) {
        if (!get().loaded) set({ pos: (await import("../data/mock-pos")).MOCK_POS });
        set({ loaded: true, loading: false, loadedAt: new Date() });
        return;
      }
      const m = await dv();
      const [pos, receipts, deliveries] = await Promise.all([
        m.fetchAllJobPOs(),
        m.fetchPoReceipts().catch((e) => {
          console.warn("[po-receiving] receipts not available yet (table not created?)", e);
          return [] as PoReceipt[];
        }),
        m.fetchPoDeliveries().catch(() => [] as PoDelivery[]),
      ]);
      set({
        pos,
        receipts: new Map(receipts.map((r) => [r.poNo, r])),
        deliveries: groupDeliveries(deliveries),
        loaded: true,
        loading: false,
        loadedAt: new Date(),
      });
    } catch (e) {
      set({
        loading: false,
        loaded: true,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  setStatus: async (po, status, by) => {
    const before = summaryOf(get(), po.jobNo);
    const receipt: PoReceipt = {
      poNo: po.poNo,
      jobNo: po.jobNo,
      vendorStatus: status,
      statusBy: by,
      statusAt: new Date().toISOString(),
    };
    set((s) => ({ receipts: new Map(s.receipts).set(po.poNo, receipt) }));
    if (!LIVE) return;
    let saved = false;
    await persistOrReport("Set PO status", async () => {
      await (await dv()).savePoReceipt(receipt);
      saved = true;
    });
    if (saved) afterChange(po.jobNo, before);
  },

  receive: async (po, d, by) => {
    const before = summaryOf(get(), po.jobNo);
    const delivery: PoDelivery = {
      id: newId(),
      poNo: po.poNo,
      jobNo: po.jobNo,
      receivedBy: by,
      ...d,
    };
    const receipt: PoReceipt = {
      poNo: po.poNo,
      jobNo: po.jobNo,
      vendorStatus: statusAfterDelivery(d.final),
      statusBy: by,
      statusAt: new Date().toISOString(),
    };
    set((s) => ({
      deliveries: new Map(s.deliveries).set(po.poNo, [...(s.deliveries.get(po.poNo) ?? []), delivery]),
      receipts: new Map(s.receipts).set(po.poNo, receipt),
    }));
    if (!LIVE) return;
    let saved = false;
    await persistOrReport("Receive a delivery", async () => {
      const m = await dv();
      await m.savePoDelivery(delivery);
      await m.savePoReceipt(receipt);
      saved = true;
    });
    // Only a saved receipt completes Job Purchasing in BC.
    if (saved) afterChange(po.jobNo, before);
  },

  updateDelivery: async (d) => {
    set((s) => ({
      deliveries: new Map(s.deliveries).set(
        d.poNo,
        (s.deliveries.get(d.poNo) ?? []).map((x) => (x.id === d.id ? d : x)),
      ),
    }));
    if (!LIVE) return;
    await persistOrReport("Edit a delivery", async () => (await dv()).savePoDelivery(d));
  },

  removeDelivery: async (d) => {
    set((s) => ({
      deliveries: new Map(s.deliveries).set(
        d.poNo,
        (s.deliveries.get(d.poNo) ?? []).filter((x) => x.id !== d.id),
      ),
    }));
    if (!LIVE) return;
    await persistOrReport("Remove a delivery", async () => (await dv()).deletePoDelivery(d.id));
  },
}));

function groupDeliveries(list: readonly PoDelivery[]): Map<string, PoDelivery[]> {
  const out = new Map<string, PoDelivery[]>();
  for (const d of list) out.set(d.poNo, [...(out.get(d.poNo) ?? []), d]);
  for (const [k, v] of out)
    out.set(
      k,
      [...v].sort((a, b) => a.date.localeCompare(b.date)),
    );
  return out;
}

type Snapshot = Pick<PoReceivingState, "pos" | "receipts" | "deliveries">;

/** A PO's Vendor Status (set, else from its deliveries). */
export function statusIn(s: Snapshot, poNo: string): string {
  return vendorStatusOf(s.receipts.get(poNo), s.deliveries.get(poNo) ?? []);
}

// Each loaded PO list → its POs by job (one pass, reused by every row / card).
const byJobCache = new WeakMap<readonly WarehousePO[], Map<string, WarehousePO[]>>();
/** A job's POs. */
export function posOf(s: Pick<Snapshot, "pos">, jobNo: string): WarehousePO[] {
  let m = byJobCache.get(s.pos);
  if (!m) {
    m = new Map();
    for (const p of s.pos) m.set(p.jobNo, [...(m.get(p.jobNo) ?? []), p]);
    byJobCache.set(s.pos, m);
  }
  return m.get(jobNo) ?? [];
}

/** A job's PO roll-up. */
export function summaryOf(s: Snapshot, jobNo: string): JobPoSummary {
  return jobPoSummary(
    posOf(s, jobNo),
    (poNo) => statusIn(s, poNo),
    (poNo) => s.deliveries.get(poNo) ?? [],
  );
}

/** After a receiving change: the job just became Materials ready → complete BC's Job Purchasing step. */
function afterChange(jobNo: string, before: JobPoSummary): void {
  if (!jobNo || before.materialsReady || !summaryOf(usePoReceivingStore.getState(), jobNo).materialsReady) return;
  void (async () => {
    try {
      const [m, sync] = await Promise.all([dv(), import("../services/bc-planning-sync")]);
      const completedBy = await m.myResourceNo().catch(() => "");
      await m.enqueueBcPush(
        sync.buildStepStatePush({
          jobNo,
          state: {
            step: "Job Purchasing",
            started: true,
            complete: true,
            keys: [],
          },
          by: "Materials ready",
          completedBy,
        }),
      );
    } catch (e) {
      console.warn("[po-receiving] Job Purchasing push failed (non-blocking)", e);
    }
  })();
}

/** React: a job's PO roll-up (loads the POs the first time). */
export function useJobPoSummary(jobNo: string | undefined): JobPoSummary | null {
  const pos = usePoReceivingStore((s) => s.pos);
  const receipts = usePoReceivingStore((s) => s.receipts);
  const deliveries = usePoReceivingStore((s) => s.deliveries);
  const loaded = usePoReceivingStore((s) => s.loaded);
  const load = usePoReceivingStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  if (!jobNo || !loaded) return null;
  return summaryOf({ pos, receipts, deliveries }, jobNo);
}
