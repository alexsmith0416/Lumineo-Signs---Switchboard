import { useEffect, useMemo } from "react";
import type { QueueKind } from "../services/job-queue-data";
import { bucketStoreFor } from "../store/bucket-store";
import { useJobDeptCompletionStore } from "../store/job-dept-completion-store";
import { useJobRows } from "./useJobRows";

/**
 * Keeps a board's Bucket Lists current while the board is open: loads them,
 * drops jobs whose step for the bucket's department is complete, and re-runs
 * filter lists against the Jobs list rows whenever those change.
 */
export function useBucketSync(kind: QueueKind | null): void {
  const store = bucketStoreFor(kind ?? "production");
  const lists = store((s) => s.lists);
  const items = store((s) => s.items);
  const loaded = store((s) => s.loaded);
  const load = store((s) => s.load);
  const completions = useJobDeptCompletionStore((s) => s.byJob);
  const loadCompletions = useJobDeptCompletionStore((s) => s.load);
  const rows = useJobRows();
  useEffect(() => {
    if (!kind) return;
    void load();
    void loadCompletions();
  }, [kind, load, loadCompletions]);
  const completedSteps = useMemo(() => {
    const cache = new Map<string, ReadonlySet<string>>();
    return (jobNo: string): ReadonlySet<string> => {
      let s = cache.get(jobNo);
      if (!s) cache.set(jobNo, (s = new Set(Object.keys(completions[jobNo] ?? {}))));
      return s;
    };
  }, [completions]);
  useEffect(() => {
    if (!kind || !loaded) return;
    store.getState().applyDropOffs(completedSteps);
  }, [kind, loaded, lists, items, completedSteps, store]);
  const hasFilters = lists.some((l) => l.mode === "filter");
  useEffect(() => {
    if (!kind || !loaded || !hasFilters || !rows.length) return;
    store.getState().syncFilters(rows, completedSteps);
  }, [kind, loaded, hasFilters, lists, rows, completedSteps, store]);
}
