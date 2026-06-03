import { useState, useEffect, useCallback } from 'react';
import { VIEW_COLS } from '../data/viewConfigs';
import { getContext } from '../data/dataverse';

const PREFS_TABLE = 'lni_userviewpreferences';

export interface ViewPref {
  hidden: string[];    // hidden column keys for this view
  order: string[];     // full ordered column list (may be superset of visible)
}

type PrefsMap = Record<string, ViewPref>;


export function useViewPrefs() {
  const [prefs, setPrefs] = useState<PrefsMap>({});
  const [prefRecordIds, setPrefRecordIds] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const client = await getContext();
        const userId = client.userSettings.userId;
        const result = await client.webAPI.retrieveMultipleRecords(
          PREFS_TABLE,
          `?$filter=lni_userid eq '${userId}'`
        );
        const map: PrefsMap = {};
        const ids: Record<string, string> = {};
        for (const e of result.entities) {
          const viewName = e['lni_viewname'] as string;
          map[viewName] = {
            hidden: JSON.parse((e['lni_hiddencolumns'] as string) || '[]'),
            order:  JSON.parse((e['lni_columnorder']  as string) || '[]'),
          };
          ids[viewName] = e['lni_userviewpreferencesid'] as string;
        }
        setPrefs(map);
        setPrefRecordIds(ids);
      } catch {
        // Not in Power Apps context (local dev) — use defaults
      }
    }
    load();
  }, []);

  const getVisibleCols = useCallback((viewName: string): string[] => {
    const pref = prefs[viewName];
    if (!pref) return VIEW_COLS[viewName] ?? [];
    const base = pref.order.length > 0 ? pref.order : (VIEW_COLS[viewName] ?? pref.order);
    return base.filter(k => !pref.hidden.includes(k));
  }, [prefs]);

  const savePref = useCallback(async (viewName: string, pref: ViewPref) => {
    setPrefs(prev => ({ ...prev, [viewName]: pref }));
    try {
      const client = await getContext();
      const userId = client.userSettings.userId;
      const data = {
        lni_userid:        userId,
        lni_viewname:      viewName,
        lni_hiddencolumns: JSON.stringify(pref.hidden),
        lni_columnorder:   JSON.stringify(pref.order),
      };
      const existingId = prefRecordIds[viewName];
      if (existingId) {
        await client.webAPI.updateRecord(PREFS_TABLE, existingId, data);
      } else {
        const result = await client.webAPI.createRecord(PREFS_TABLE, data);
        setPrefRecordIds(prev => ({ ...prev, [viewName]: result.id }));
      }
    } catch {
      // Local dev — skip persistence
    }
  }, [prefRecordIds]);

  return { getVisibleCols, savePref, prefs };
}
