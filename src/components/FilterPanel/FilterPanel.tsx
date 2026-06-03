import { FIELD_DEFS } from '../../data/fieldDefs';
import type { FilterCondition } from '../../hooks/useGrid';
import type { CustomFieldDef } from '../../types/schema';

const OPS: { value: FilterCondition['op']; label: string }[] = [
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is',           label: 'is' },
  { value: 'is_not',       label: 'is not' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

let _id = 0;
const nextId = () => String(++_id);

interface Props {
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
  onClose: () => void;
  customFieldDefs?: CustomFieldDef[];
}

export default function FilterPanel({ filters, onChange, onClose, customFieldDefs = [] }: Props) {
  const staticFields = Object.keys(FIELD_DEFS);
  const allFields = [...staticFields, ...customFieldDefs.map(d => d.key)];
  const getLabel = (key: string) => FIELD_DEFS[key]?.label ?? customFieldDefs.find(d => d.key === key)?.label ?? key;

  const add = () =>
    onChange([...filters, { id: nextId(), field: 'job', op: 'contains', value: '' }]);

  const remove = (id: string) => onChange(filters.filter(f => f.id !== id));

  const update = (id: string, patch: Partial<FilterCondition>) =>
    onChange(filters.map(f => f.id === id ? { ...f, ...patch } : f));

  const noValue = (op: FilterCondition['op']) =>
    op === 'is_empty' || op === 'is_not_empty';

  return (
    <div className="panel-dropdown panel-filter" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <span>Filter</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      {filters.length === 0 && <div className="panel-empty">No filters — add one below.</div>}
      {filters.map(f => (
        <div key={f.id} className="panel-row filter-row">
          <select value={f.field} onChange={e => update(f.id, { field: e.target.value })}>
            {allFields.map(k => <option key={k} value={k}>{getLabel(k)}</option>)}
          </select>
          <select value={f.op} onChange={e => update(f.id, { op: e.target.value as FilterCondition['op'] })}>
            {OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {!noValue(f.op) && (
            <input
              type="text"
              className="filter-val"
              placeholder="value…"
              value={f.value}
              onChange={e => update(f.id, { value: e.target.value })}
            />
          )}
          <button className="panel-remove" onClick={() => remove(f.id)}>✕</button>
        </div>
      ))}
      <div className="panel-footer">
        <button className="panel-add-btn" onClick={add}>+ Add filter</button>
        {filters.length > 0 && (
          <button className="panel-clear-btn" onClick={() => onChange([])}>Clear all</button>
        )}
      </div>
    </div>
  );
}
