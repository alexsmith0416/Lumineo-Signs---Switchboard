import { useState } from 'react';
import type { CustomFieldDef, CustomFieldType, FormulaDateConfig } from '../../types/schema';

const TYPE_OPTIONS: { type: CustomFieldType; icon: string; label: string }[] = [
  { type: 'text',      icon: 'Aa', label: 'Text' },
  { type: 'multiline', icon: '¶',  label: 'Long text' },
  { type: 'number',    icon: '#',  label: 'Number' },
  { type: 'currency',  icon: '$',  label: 'Currency' },
  { type: 'date',      icon: '⬚',  label: 'Date' },
  { type: 'bool',      icon: '☑',  label: 'Checkbox' },
  { type: 'select',    icon: '▼',  label: 'Select' },
  { type: 'url',          icon: '↗',   label: 'URL' },
  { type: 'email',        icon: '@',   label: 'Email' },
  { type: 'phone',        icon: '☎',   label: 'Phone' },
  { type: 'formula-date', icon: 'f()', label: 'Formula Date' },
];

const DEFAULT_WIDTH: Record<CustomFieldType, number> = {
  text: 160, multiline: 200, number: 100, currency: 110,
  date: 120, bool: 80, select: 150, url: 180, email: 180, phone: 130,
  'formula-date': 120,
};

interface StagedField {
  tempId: string;
  label: string;
  type: CustomFieldType;
  opts: string[];
  width: number;
  formulaConfig?: FormulaDateConfig;
}

interface CurrentField {
  label: string;
  type: CustomFieldType;
  opts: string[];
  width: number;
  formulaConfig?: FormulaDateConfig;
}

const blank = (): CurrentField => ({ label: '', type: 'text', opts: [], width: 160, formulaConfig: undefined });

const DATE_FIELDS = [
  { key: 'orderDate', label: 'Order Date' },
  { key: 'scheduledInstall', label: 'Sched. Install' },
  { key: 'mfgTargetMod', label: 'Mfg Target Mod' },
  { key: 'redDate', label: 'RED DATE' },
  { key: 'vendorShipDate', label: 'Vendor Ship Date' },
  { key: 'expeditor', label: 'Expeditor' },
];

interface Props {
  defs: CustomFieldDef[];
  onAddFields: (fields: Omit<CustomFieldDef, 'key'>[]) => void;
  onUpdate: (key: string, patch: Partial<Omit<CustomFieldDef, 'key'>>) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
}

export default function FieldManager({ onAddFields, onClose }: Props) {
  const [staged, setStaged] = useState<StagedField[]>([]);
  const [current, setCurrent] = useState<CurrentField>(blank);

  const icon = (type: CustomFieldType) => TYPE_OPTIONS.find(t => t.type === type)?.icon ?? 'Aa';
  const typeLabel = (type: CustomFieldType) => TYPE_OPTIONS.find(t => t.type === type)?.label ?? type;

  const defaultFc = (s: CurrentField): FormulaDateConfig =>
    s.formulaConfig ?? { baseField: 'orderDate', offset: 0, unit: 'weeks' };

  const pushCurrent = (): StagedField[] => {
    if (!current.label.trim()) return staged;
    return [...staged, { ...current, label: current.label.trim(), formulaConfig: current.formulaConfig, tempId: `t${Date.now()}` }];
  };

  const addAnother = () => {
    setStaged(pushCurrent());
    setCurrent(blank());
  };

  const done = () => {
    const all = pushCurrent();
    if (all.length > 0) {
      onAddFields(all.map(({ tempId: _, ...f }) => f));
    }
    onClose();
  };

  const addOpt = () => setCurrent(s => ({ ...s, opts: [...s.opts, ''] }));
  const updateOpt = (i: number, val: string) =>
    setCurrent(s => ({ ...s, opts: s.opts.map((o, idx) => idx === i ? val : o) }));
  const removeOpt = (i: number) =>
    setCurrent(s => ({ ...s, opts: s.opts.filter((_, idx) => idx !== i) }));

  return (
    <div className="cp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fm-panel">
        <div className="cp-header">
          Add Fields
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text2)' }}>×</button>
        </div>

        {staged.length > 0 && (
          <div className="fm-staged">
            <div className="fm-staged-label">Ready to add ({staged.length})</div>
            {staged.map(f => (
              <div key={f.tempId} className="fm-staged-row">
                <span className="fm-type-icon">{icon(f.type)}</span>
                <span className="fm-field-label">{f.label}</span>
                <span className="fm-type-badge">{typeLabel(f.type)}</span>
                <button className="fm-action-btn delete" onClick={() => setStaged(prev => prev.filter(x => x.tempId !== f.tempId))}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="fm-form">
          <label className="fm-label">Field name</label>
          <input
            className="fm-input"
            type="text"
            placeholder="e.g. Permit Status"
            value={current.label}
            onChange={e => setCurrent(s => ({ ...s, label: e.target.value }))}
            autoFocus
          />
          <label className="fm-label" style={{ marginTop: 14 }}>Field type</label>
          <div className="fm-type-grid">
            {TYPE_OPTIONS.map(t => (
              <button
                key={t.type}
                className={`fm-type-btn${current.type === t.type ? ' active' : ''}`}
                onClick={() => setCurrent(s => ({
                  ...s, type: t.type, width: DEFAULT_WIDTH[t.type],
                  opts: t.type === 'select' ? s.opts : [],
                  formulaConfig: t.type === 'formula-date'
                    ? (s.formulaConfig ?? { baseField: 'orderDate', offset: 0, unit: 'weeks' })
                    : s.formulaConfig,
                }))}
              >
                <span className="fm-type-btn-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          {current.type === 'select' && (
            <>
              <label className="fm-label" style={{ marginTop: 14 }}>Options</label>
              {current.opts.map((opt, i) => (
                <div key={i} className="fm-opt-row">
                  <input
                    className="fm-opt-input"
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => updateOpt(i, e.target.value)}
                  />
                  <button className="fm-action-btn delete" onClick={() => removeOpt(i)}>×</button>
                </div>
              ))}
              <button className="panel-add-btn" style={{ padding: '4px 0', marginTop: 4 }} onClick={addOpt}>
                + Add option
              </button>
            </>
          )}
          {current.type === 'formula-date' && (
            <>
              <label className="fm-label" style={{ marginTop: 14 }}>Base date field</label>
              <select
                className="fm-input"
                value={current.formulaConfig?.baseField ?? 'orderDate'}
                onChange={e => setCurrent(s => ({ ...s, formulaConfig: { ...defaultFc(s), baseField: e.target.value } }))}
              >
                {DATE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <label className="fm-label" style={{ marginTop: 10 }}>Offset</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="fm-input"
                  type="number"
                  min={-365} max={365}
                  style={{ width: 80 }}
                  value={current.formulaConfig?.offset ?? 0}
                  onChange={e => setCurrent(s => ({ ...s, formulaConfig: { ...defaultFc(s), offset: Number(e.target.value) } }))}
                />
                <select
                  className="fm-input"
                  style={{ flex: 1 }}
                  value={current.formulaConfig?.unit ?? 'weeks'}
                  onChange={e => setCurrent(s => ({ ...s, formulaConfig: { ...defaultFc(s), unit: e.target.value as 'days' | 'weeks' } }))}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                = {DATE_FIELDS.find(f => f.key === (current.formulaConfig?.baseField ?? 'orderDate'))?.label} + {current.formulaConfig?.offset ?? 0} {current.formulaConfig?.unit ?? 'weeks'}
              </div>
            </>
          )}
          <div className="fm-form-footer">
            <button
              className="cp-btn secondary"
              style={{ flex: '0 0 auto', padding: '6px 14px' }}
              onClick={addAnother}
              disabled={!current.label.trim()}
            >
              + Add another
            </button>
            <button
              className="cp-btn primary"
              style={{ flex: '0 0 auto', padding: '6px 16px' }}
              onClick={done}
              disabled={staged.length === 0 && !current.label.trim()}
            >
              Done ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
