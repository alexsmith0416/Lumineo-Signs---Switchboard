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

  const run = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const cached = cache.current.get(q);
    if (cached) {
      setResults(cached);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const jobs = await bcService.searchJob(q);
      const mapped: JobSearchResult[] = jobs.map((job) => ({
        job,
        mappedLines: mapPlanningLines(job.planningLines),
      }));
      cache.current.set(q, mapped);
      setResults(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
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
