import { FIELD_DEFS } from '../../data/fieldDefs';
import type { SortCriterion } from '../../hooks/useGrid';

const SORTABLE = Object.keys(FIELD_DEFS).filter(k => FIELD_DEFS[k].type !== 'readonly');

interface Props {
  sorts: SortCriterion[];
  onChange: (sorts: SortCriterion[]) => void;
  onClose: () => void;
}

export default function SortPanel({ sorts, onChange, onClose }: Props) {
  const add = () => {
    const used = new Set(sorts.map(s => s.field));
    const next = SORTABLE.find(f => !used.has(f)) ?? SORTABLE[0];
    onChange([...sorts, { field: next, asc: true }]);
  };

  const remove = (i: number) => onChange(sorts.filter((_, idx) => idx !== i));

  const update = (i: number, patch: Partial<SortCriterion>) =>
    onChange(sorts.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const move = (i: number, delta: number) => {
    const next = [...sorts];
    const j = i + delta;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="panel-dropdown" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <span>Sort</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      {sorts.length === 0 && <div className="panel-empty">No sort criteria — add one below.</div>}
      {sorts.map((s, i) => (
        <div key={i} className="panel-row">
          <span className="sort-idx">{i + 1}</span>
          <select value={s.field} onChange={e => update(i, { field: e.target.value })}>
            {SORTABLE.map(f => <option key={f} value={f}>{FIELD_DEFS[f].label}</option>)}
          </select>
          <button className={`dir-btn${s.asc ? ' active' : ''}`} onClick={() => update(i, { asc: true })}>A→Z</button>
          <button className={`dir-btn${!s.asc ? ' active' : ''}`} onClick={() => update(i, { asc: false })}>Z→A</button>
          <div className="panel-move-wrap">
            {i > 0 && <button className="panel-move" onClick={() => move(i, -1)}>↑</button>}
            {i < sorts.length - 1 && <button className="panel-move" onClick={() => move(i, 1)}>↓</button>}
          </div>
          <button className="panel-remove" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <div className="panel-footer">
        <button className="panel-add-btn" onClick={add}>+ Add sort</button>
        {sorts.length > 0 && (
          <button className="panel-clear-btn" onClick={() => onChange([])}>Clear all</button>
        )}
      </div>
    </div>
  );
}
