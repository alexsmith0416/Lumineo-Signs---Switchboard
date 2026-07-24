import { useCallback, useEffect, useRef, useState } from "react";
import { bcService, type BcJob } from "../services/bc";
import { mapPlanningLines, type MappedPlanningLine } from "../services/planning-line-mapping";

export interface JobSearchResult {
  job: BcJob;
  mappedLines: MappedPlanningLine[];
}

interface UseJobSearch {
  query: string;
  setQuery: (q: string) => void;
  results: JobSearchResult[];
  loading: boolean;
  error: string | null;
}

const SEARCH_DEBOUNCE_MS = 200;

export function useJobSearch(): UseJobSearch {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, JobSearchResult[]>>(new Map());
  const timer = useRef<number | undefined>(undefined);
  // Monotonic request token — only the newest query's response is applied, so a
  // slower earlier request can't overwrite a faster later one (the "type fast →
  // nothing shows" race). Also tracks the latest query text so a stale resolve
  // for a query the user has since changed is dropped.
  const seq = useRef(0);
  const latestQuery = useRef("");

  const run = useCallback(async (q: string) => {
    latestQuery.current = q;
    if (!q.trim()) {
      seq.current++; // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      return;
    }
    const cached = cache.current.get(q);
    if (cached) {
      seq.current++;
      setResults(cached);
      setLoading(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const jobs = await bcService.searchJob(q);
      const mapped: JobSearchResult[] = jobs.map((job) => ({
        job,
        mappedLines: mapPlanningLines(job.planningLines),
      }));
      cache.current.set(q, mapped);
      if (mySeq === seq.current) setResults(mapped); // still the latest → apply
    } catch (err) {
      if (mySeq === seq.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => run(query), SEARCH_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, run]);

  return { query, setQuery, results, loading, error };
}
