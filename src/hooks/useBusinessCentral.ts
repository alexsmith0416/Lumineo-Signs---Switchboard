import { useState, useCallback } from 'react';
import { getContext } from '../data/dataverse';
import { BC_SORT_ORDER_MAP } from '../data/bcConfig';

const BC_TABLE = 'lni_bcplanningline';

export interface BcPlanningLine {
  jobNo: string;
  sortOrder: number;
  stageName: string;
  description: string;
  started: boolean;
  completed: boolean;
  startDate: string | null;
  endDate: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
}

export type BcStatus = 'idle' | 'loading' | 'ready' | 'error';

interface BcState {
  status: BcStatus;
  lines: BcPlanningLine[];
  byJob: Record<string, BcPlanningLine[]>;
  error: string | null;
  lastFetched: Date | null;
}

function parseRow(e: Record<string, unknown>): BcPlanningLine {
  const sortOrder = Number(e['lni_sortorder'] ?? -1);
  return {
    jobNo:          String(e['lni_jobno'] ?? ''),
    sortOrder,
    stageName:      String(e['lni_stagename'] ?? BC_SORT_ORDER_MAP[sortOrder] ?? `Stage ${sortOrder}`),
    description:    String(e['lni_description'] ?? ''),
    started:        Boolean(e['lni_started']),
    completed:      Boolean(e['lni_completed']),
    startDate:      (e['lni_startdate'] as string) ?? null,
    endDate:        (e['lni_enddate'] as string) ?? null,
    assignedTo:     (e['lni_assignedto'] as string) ?? null,
    assignedToName: (e['lni_assignedtoname'] as string) ?? null,
  };
}

export function useBusinessCentral() {
  const [state, setState] = useState<BcState>({
    status: 'idle', lines: [], byJob: {}, error: null, lastFetched: null,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const client = await getContext();
      const result = await client.webAPI.retrieveMultipleRecords(
        BC_TABLE,
        '?$orderby=lni_jobno,lni_sortorder'
      );
      const lines = result.entities.map(e => parseRow(e as Record<string, unknown>));
      const byJob: Record<string, BcPlanningLine[]> = {};
      for (const line of lines) {
        if (!byJob[line.jobNo]) byJob[line.jobNo] = [];
        byJob[line.jobNo].push(line);
      }
      setState({ status: 'ready', lines, byJob, error: null, lastFetched: new Date() });
    } catch (err) {
      setState(s => ({ ...s, status: 'error', error: String(err) }));
    }
  }, []);

  // Returns the currently active stage for a job:
  // first line that is started but not completed,
  // or first unstarted line, or the last line if all done
  const getCurrentStage = useCallback((jobNo: string): BcPlanningLine | null => {
    const lines = state.byJob[jobNo];
    if (!lines?.length) return null;
    return lines.find(l => l.started && !l.completed)
      ?? lines.find(l => !l.started)
      ?? lines[lines.length - 1];
  }, [state.byJob]);

  // Returns all lines for a job sorted by sortOrder
  const getJobLines = useCallback((jobNo: string): BcPlanningLine[] =>
    state.byJob[jobNo] ?? [], [state.byJob]);

  return { state, refresh, getCurrentStage, getJobLines };
}
