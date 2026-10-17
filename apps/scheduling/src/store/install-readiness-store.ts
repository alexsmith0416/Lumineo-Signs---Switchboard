import { useEffect, useMemo } from "react";
import { create } from "zustand";
import type { ScheduleLine } from "../engine/types";
import { installWarnings, type ProdCard } from "../services/install-readiness";
import { deptKeyForName } from "../services/production-steps";
import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { summaryOf, usePoReceivingStore } from "./po-receiving-store";
import { useScheduleStore } from "./schedule-store";
import { showNotice } from "./notice-store";

/**
 * Install readiness (services/install-readiness.ts): each install-board job's
 * Production cards (any week) — read once per job, re-read when one of its
 * install cards is added or moved — plus its stepper and POs, turned into
 * warnings for the ⚠ chip and the add / move notice. Warn only: nothing is
 * refused.
 */
const LIVE = import.meta.env.PROD || import.meta.env.VITE_DATA_SOURCE === "live";

type Card = { deptName: string; end: Date };

interface ReadinessState {
  prodByJob: Record<string, Card[]>;
  /** Read the production cards of jobs not read yet (or all of them, forced). */
  ensure: (jobNos: readonly string[], force?: boolean) => Promise<void>;
}

const pending = new Set<string>();

async function readCards(jobNos: readonly string[]): Promise<Map<string, Card[]>> {
  if (LIVE) return (await import("../services/dataverse-live")).productionCardsForJobs(jobNos);
  // Dev: the Production board's loaded week stands in.
  const { schedule, departments } = useScheduleStore.getState();
  const want = new Set(jobNos);
  const out = new Map<string, Card[]>();
  for (const l of schedule) {
    if (l.isCustom || !want.has(l.jobNo)) continue;
    out.set(l.jobNo, [...(out.get(l.jobNo) ?? []), { deptName: departments.get(l.departmentId)?.name ?? "", end: l.endDateTime }]);
  }
  return out;
}

export const useInstallReadinessStore = create<ReadinessState>((set, get) => ({
  prodByJob: {},
  ensure: async (jobNos, force = false) => {
    const todo = [...new Set(jobNos)].filter((j) => j && !pending.has(j) && (force || !(j in get().prodByJob)));
    if (!todo.length) return;
    for (const j of todo) pending.add(j);
    try {
      const got = await readCards(todo);
      set((s) => {
        const next = { ...s.prodByJob };
        for (const j of todo) next[j] = got.get(j) ?? [];
        return { prodByJob: next };
      });
    } catch (e) {
      console.warn("[install-readiness] couldn't read production cards", e);
    } finally {
      for (const j of todo) pending.delete(j);
    }
  },
}));

type PoSnapshot = Parameters<typeof summaryOf>[0];

function compute(
  cards: readonly Card[],
  completed: Record<string, unknown>,
  po: PoSnapshot | null,
  jobNo: string,
  installStart: Date,
): string[] {
  const prod: ProdCard[] = cards.map((c) => {
    const key = deptKeyForName(c.deptName);
    return { ...c, done: !!(key && completed[key]) };
  });
  const materials = po ? summaryOf(po, jobNo) : null;
  return installWarnings({ installStart, prod, materials: materials && materials.open ? materials : null });
}

/** The warnings for one install card, from what's loaded now. */
export function warningsFor(jobNo: string, installStart: Date): string[] {
  const po = usePoReceivingStore.getState();
  return compute(
    useInstallReadinessStore.getState().prodByJob[jobNo] ?? [],
    useJobDeptCompletionStore.getState().byJob[jobNo] ?? {},
    po.loaded ? po : null,
    jobNo,
    installStart,
  );
}

// Edits close together (Auto-plan's Commit adds a card at a time) → one notice.
const queued = new Map<string, ScheduleLine>();
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * After install cards were added / moved: re-read their jobs' production cards
 * and say so if any is early. Fire-and-forget; never blocks the edit.
 */
export function noticeInstallReadiness(lines: readonly ScheduleLine[]): void {
  for (const l of lines) {
    const prev = queued.get(l.jobNo);
    if (!prev || l.startDateTime < prev.startDateTime) queued.set(l.jobNo, l);
  }
  noticeTimer ??= setTimeout(() => {
    noticeTimer = null;
    const batch = [...queued.values()];
    queued.clear();
    void checkAndNotice(batch);
  }, 400);
}

async function checkAndNotice(lines: readonly ScheduleLine[]): Promise<void> {
  if (!lines.length) return;
  try {
    await Promise.all([
      useInstallReadinessStore.getState().ensure(lines.map((l) => l.jobNo), true),
      usePoReceivingStore.getState().load(),
      useJobDeptCompletionStore.getState().load(),
    ]);
    const hits = lines
      .map((l) => ({ jobNo: l.jobNo, why: warningsFor(l.jobNo, l.startDateTime) }))
      .filter((h) => h.why.length);
    if (!hits.length) return;
    showNotice({
      title: hits.length === 1 ? `Job ${hits[0]!.jobNo} may not be ready to install` : "Some jobs may not be ready to install",
      message: hits.map((h) => `${hits.length > 1 ? `${h.jobNo}: ` : ""}${h.why.join("; ")}.`).join("\n"),
    });
  } catch (e) {
    console.warn("[install-readiness] check failed", e);
  }
}

// Cards ask for their job one at a time; gather a render's worth into one read.
const asked = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function requestCards(jobNo: string): void {
  asked.add(jobNo);
  flushTimer ??= setTimeout(() => {
    flushTimer = null;
    const jobs = [...asked];
    asked.clear();
    void useInstallReadinessStore.getState().ensure(jobs);
  }, 50);
}

/** React: the ⚠ reasons for an install card (loads what it needs once). */
export function useInstallWarnings(line: ScheduleLine, enabled: boolean): string[] {
  const on = enabled && !!line.jobNo && !line.isCustom && !line.mirrorOf;
  const cards = useInstallReadinessStore((s) => (on ? s.prodByJob[line.jobNo] : undefined));
  const completed = useJobDeptCompletionStore((s) => (on ? s.byJob[line.jobNo] : undefined));
  const loaded = usePoReceivingStore((s) => s.loaded);
  const pos = usePoReceivingStore((s) => s.pos);
  const receipts = usePoReceivingStore((s) => s.receipts);
  const deliveries = usePoReceivingStore((s) => s.deliveries);
  useEffect(() => {
    if (!on) return;
    requestCards(line.jobNo);
    void usePoReceivingStore.getState().load();
  }, [on, line.jobNo]);
  return useMemo(
    () =>
      on && cards
        ? compute(cards, completed ?? {}, loaded ? { pos, receipts, deliveries } : null, line.jobNo, line.startDateTime)
        : [],
    [on, cards, completed, loaded, pos, receipts, deliveries, line.jobNo, line.startDateTime],
  );
}
