import { useState, useCallback } from 'react';
import type React from 'react';
import type { CustomFieldDef, FormulaDateConfig, LniRecord } from '../types/schema';

function computeFormulaDate(record: LniRecord, cfg: FormulaDateConfig): string {
  const base = record[cfg.baseField as keyof LniRecord];
  if (!base || typeof base !== 'string' || !base.match(/^\d{4}/)) return '';
  const d = new Date(base);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (cfg.unit === 'weeks' ? cfg.offset * 7 : cfg.offset));
  return d.toISOString().slice(0, 10);
}

function defsKey(scheduleId: string) {
  return scheduleId === 'default' ? 'lni_customFieldDefs' : `lni_customFieldDefs_${scheduleId}`;
}
function valsKey(scheduleId: string) {
  return scheduleId === 'default' ? 'lni_customFieldVals' : `lni_customFieldVals_${scheduleId}`;
}

type CustomValues = Record<string, Record<string, unknown>>;

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}

export function useCustomFields(scheduleId: string, recordsRef?: React.MutableRefObject<LniRecord[]>) {
  const [defs, setDefs] = useState<CustomFieldDef[]>(() => load(defsKey(scheduleId), []));
  const [vals, setVals] = useState<CustomValues>(() => load(valsKey(scheduleId), {}));

  const saveDefs = useCallback((next: CustomFieldDef[]) => {
    setDefs(next);
    localStorage.setItem(defsKey(scheduleId), JSON.stringify(next));
  }, [scheduleId]);

  const saveVals = useCallback((next: CustomValues) => {
    setVals(next);
    localStorage.setItem(valsKey(scheduleId), JSON.stringify(next));
  }, [scheduleId]);

  const getValue = useCallback((recordId: string, fieldKey: string): unknown => {
    const def = defs.find(d => d.key === fieldKey);
    if (def?.type === 'formula-date' && def.formulaConfig && recordsRef) {
      const rec = recordsRef.current.find(r => r.id === recordId);
      if (rec) return computeFormulaDate(rec, def.formulaConfig);
      return '';
    }
    return vals[recordId]?.[fieldKey] ?? null;
  }, [defs, vals, recordsRef]);

  const setValue = useCallback((recordId: string, fieldKey: string, value: unknown) => {
    saveVals({ ...vals, [recordId]: { ...(vals[recordId] ?? {}), [fieldKey]: value } });
  }, [vals, saveVals]);

  const addFields = useCallback((fields: Omit<CustomFieldDef, 'key'>[]): string[] => {
    const entries = fields.map((f, i) => ({ ...f, key: `cf_${Date.now()}_${i}` }));
    saveDefs([...defs, ...entries]);
    return entries.map(e => e.key);
  }, [defs, saveDefs]);

  const updateField = useCallback((key: string, patch: Partial<Omit<CustomFieldDef, 'key'>>) => {
    saveDefs(defs.map(d => d.key === key ? { ...d, ...patch } : d));
  }, [defs, saveDefs]);

  const deleteField = useCallback((key: string) => {
    saveDefs(defs.filter(d => d.key !== key));
    const next = Object.fromEntries(
      Object.entries(vals).map(([rid, fvs]) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _dropped, ...rest } = fvs;
        return [rid, rest];
      })
    );
    saveVals(next);
  }, [defs, vals, saveDefs, saveVals]);

  return { defs, getValue, setValue, addFields, updateField, deleteField };
}
