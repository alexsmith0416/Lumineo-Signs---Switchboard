import { useMemo, useState } from 'react';

import type { ComputedPieceResult, Piece } from '../lib/engine';
import { round2, searchCatalog } from '../lib/engine';
import type { CatalogItem, WorkCode } from '../repo';
import type { ComputedLaborLine, ComputedMaterialLine, InputDef } from '../data/pieceTypes';

interface Props {
  piece: Piece;
  computed: ComputedPieceResult;
  catalog: readonly CatalogItem[];
  workCodes: readonly WorkCode[];
  onChange: (p: Piece) => void;
  onRemove: () => void;
}

export function PieceEditor({ piece, computed, workCodes, onChange, onRemove }: Props) {
  const [matQuery, setMatQuery] = useState('');
  const [extraWC, setExtraWC] = useState<number | ''>('');
  const [extraHrs, setExtraHrs] = useState<number>(0);

  const results = useMemo(() => {
    if (!matQuery.trim()) return [] as readonly CatalogItem[];
    return searchCatalog(matQuery, 25);
  }, [matQuery]);

  function updateInput(key: string, value: string | number) {
    onChange({ ...piece, inputs: { ...piece.inputs, [key]: value } });
  }

  function addExtraMaterial(item: CatalogItem) {
    const next: ComputedMaterialLine[] = [
      ...(piece.extraMaterials ?? []),
      { itemNo: item.no, units: 1 },
    ];
    onChange({ ...piece, extraMaterials: next });
    setMatQuery('');
  }

  function updateExtraMaterial(idx: number, patch: Partial<ComputedMaterialLine>) {
    const cur = piece.extraMaterials ?? [];
    const next = cur.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange({ ...piece, extraMaterials: next });
  }

  function removeExtraMaterial(idx: number) {
    const cur = piece.extraMaterials ?? [];
    onChange({ ...piece, extraMaterials: cur.filter((_, i) => i !== idx) });
  }

  function addExtraLabor() {
    if (extraWC === '' || extraHrs <= 0) return;
    const next: ComputedLaborLine[] = [
      ...(piece.extraLabor ?? []),
      { workCode: Number(extraWC), hours: extraHrs },
    ];
    onChange({ ...piece, extraLabor: next });
    setExtraWC('');
    setExtraHrs(0);
  }

  function updateExtraLabor(idx: number, patch: Partial<ComputedLaborLine>) {
    const cur = piece.extraLabor ?? [];
    const next = cur.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...piece, extraLabor: next });
  }

  function removeExtraLabor(idx: number) {
    const cur = piece.extraLabor ?? [];
    onChange({ ...piece, extraLabor: cur.filter((_, i) => i !== idx) });
  }

  // Count of auto-generated material + labor lines (those come first in the
  // computed arrays) — used so we know which lines are extras vs. computed.
  const autoMatCount = (computed.materials.length) - (piece.extraMaterials?.length ?? 0);
  const autoLabCount = (computed.labor.length) - (piece.extraLabor?.length ?? 0);

  return (
    <div className="piece-detail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{computed.type.label}</h3>
        <button className="danger" onClick={onRemove}>Remove piece</button>
      </div>
      <label style={{ marginBottom: 12 }}>
        Piece label (optional)
        <input
          value={piece.label ?? ''}
          placeholder="e.g. North-facing pylon face"
          onChange={(e) => onChange({ ...piece, label: e.target.value })}
        />
      </label>

      {computed.type.status === 'todo' && (
        <div className="todo-banner">
          <strong>Math pending.</strong> This piece type's engine formula is not implemented yet.
          Inputs are saved but sqft/labor compute as zero. Source sheet: <code>{computed.type.workbookSheet}</code>.
        </div>
      )}
      {computed.notes.map((n, i) => (
        <div key={i} className="todo-banner">{n}</div>
      ))}

      <div className="inputs-grid">
        {computed.type.inputs.map(def => (
          <InputField key={def.key} def={def} value={piece.inputs[def.key]} onChange={(v) => updateInput(def.key, v)} />
        ))}
      </div>

      <div className="section-head">
        <h4>Materials</h4>
        <span className="small muted">{computed.materials.length} lines · ${round2(computed.materialTotal).toLocaleString()}</span>
      </div>
      <table className="lines-table">
        <thead>
          <tr>
            <th>Item #</th>
            <th>Description</th>
            <th className="num">Units</th>
            <th className="num">Unit $</th>
            <th className="num">Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {computed.materials.length === 0 && (
            <tr><td colSpan={6} className="muted small">No material lines yet.</td></tr>
          )}
          {computed.materials.map((m, i) => {
            const isExtra = i >= autoMatCount;
            const extraIdx = i - autoMatCount;
            return (
              <tr key={i} className="removable">
                <td>{m.itemNo}</td>
                <td>{m.description}</td>
                <td className="num">
                  {isExtra ? (
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={m.units}
                      onChange={(e) => updateExtraMaterial(extraIdx, { units: Number(e.target.value) })}
                    />
                  ) : round2(m.units)}
                </td>
                <td className="num">${round2(m.unitPrice).toLocaleString()}</td>
                <td className="num">${round2(m.total).toLocaleString()}</td>
                <td>
                  {isExtra && <button className="danger" onClick={() => removeExtraMaterial(extraIdx)}>×</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="catalog-picker">
        <input
          placeholder="Search catalog by description or item #"
          value={matQuery}
          onChange={(e) => setMatQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div className="results">
            {results.map(it => (
              <div className="result" key={it.no} onClick={() => addExtraMaterial(it)}>
                <span className="no">{it.no}</span>
                <span>{it.description}</span>
                <span className="price">${round2(it.unitPrice)} / {it.baseUoM}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-head">
        <h4>Labor</h4>
        <span className="small muted">{computed.labor.length} lines · ${round2(computed.laborTotal).toLocaleString()}</span>
      </div>
      <table className="lines-table">
        <thead>
          <tr>
            <th>Work code</th>
            <th>Description</th>
            <th className="num">Hours</th>
            <th className="num">Rate</th>
            <th className="num">Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {computed.labor.length === 0 && (
            <tr><td colSpan={6} className="muted small">No labor lines yet.</td></tr>
          )}
          {computed.labor.map((l, i) => {
            const isExtra = i >= autoLabCount;
            const extraIdx = i - autoLabCount;
            return (
              <tr key={i} className="removable">
                <td>{l.workCode}</td>
                <td>{l.description}</td>
                <td className="num">
                  {isExtra ? (
                    <input
                      type="number"
                      step="0.25"
                      style={{ width: 80 }}
                      value={l.hours}
                      onChange={(e) => updateExtraLabor(extraIdx, { hours: Number(e.target.value) })}
                    />
                  ) : round2(l.hours)}
                </td>
                <td className="num">${round2(l.hourlyRate)}</td>
                <td className="num">${round2(l.total).toLocaleString()}</td>
                <td>
                  {isExtra && <button className="danger" onClick={() => removeExtraLabor(extraIdx)}>×</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>
          Add labor: work code
          <select value={extraWC} onChange={(e) => setExtraWC(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— pick —</option>
            {workCodes.map(w => (
              <option key={w.code} value={w.code}>{w.code} · {w.description}</option>
            ))}
          </select>
        </label>
        <label style={{ width: 100 }}>
          Hours
          <input type="number" step="0.25" value={extraHrs} onChange={(e) => setExtraHrs(Number(e.target.value))} />
        </label>
        <button className="primary" onClick={addExtraLabor}>+ Add</button>
      </div>

      <div className="totals-bar" style={{ borderTop: '1px solid var(--color-gray-200)', marginTop: 16 }}>
        <div><span className="label">Materials</span> ${round2(computed.materialTotal).toLocaleString()}</div>
        <div><span className="label">Labor</span> ${round2(computed.laborTotal).toLocaleString()}</div>
        <div className="grand-total" style={{ fontSize: 16 }}>${round2(computed.total).toLocaleString()}</div>
      </div>
    </div>
  );
}

function InputField({
  def,
  value,
  onChange,
}: {
  def: InputDef;
  value: number | string | undefined;
  onChange: (v: number | string) => void;
}) {
  if (def.kind === 'select') {
    return (
      <label>
        {def.label}
        <select value={String(value ?? def.default ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(def.options ?? []).map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }
  if (def.kind === 'text') {
    return (
      <label>
        {def.label}
        <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      </label>
    );
  }
  return (
    <label>
      {def.label}{def.unit ? ` (${def.unit})` : ''}
      <input
        type="number"
        step={def.kind === 'integer' ? 1 : 'any'}
        value={Number(value ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
