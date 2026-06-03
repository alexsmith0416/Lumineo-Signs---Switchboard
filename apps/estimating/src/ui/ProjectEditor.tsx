import { useState } from 'react';

import { round2, type Project, type Piece, type ComputedProject } from '../lib/engine';
import { PIECE_TYPES, getPieceType } from '../data/pieceTypes';
import type { CatalogItem, WorkCode } from '../repo';

import { PieceEditor } from './PieceEditor';

interface Props {
  project: Project;
  computed: ComputedProject;
  catalog: readonly CatalogItem[];
  workCodes: readonly WorkCode[];
  onChange: (p: Project) => void;
}

function nextPieceId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function defaultsFor(typeId: string): Record<string, number | string> {
  const t = getPieceType(typeId);
  if (!t) return {};
  const inputs: Record<string, number | string> = {};
  for (const i of t.inputs) {
    if (i.default !== undefined) inputs[i.key] = i.default;
    else if (i.kind === 'number' || i.kind === 'integer') inputs[i.key] = 0;
    else inputs[i.key] = '';
  }
  return inputs;
}

export function ProjectEditor({ project, computed, catalog, workCodes, onChange }: Props) {
  const [activePieceId, setActivePieceId] = useState<string | null>(
    project.pieces[0]?.id ?? null
  );
  const [adderType, setAdderType] = useState<string>(PIECE_TYPES[0]?.id ?? '');

  function updateHeader<K extends keyof Project>(key: K, value: Project[K]) {
    onChange({ ...project, [key]: value });
  }

  function addPiece() {
    if (!adderType) return;
    const piece: Piece = {
      id: nextPieceId(),
      typeId: adderType,
      inputs: defaultsFor(adderType),
    };
    onChange({ ...project, pieces: [...project.pieces, piece] });
    setActivePieceId(piece.id);
  }

  function updatePiece(updated: Piece) {
    onChange({
      ...project,
      pieces: project.pieces.map(p => (p.id === updated.id ? updated : p)),
    });
  }

  function removePiece(id: string) {
    onChange({ ...project, pieces: project.pieces.filter(p => p.id !== id) });
    if (activePieceId === id) {
      const next = project.pieces.find(p => p.id !== id);
      setActivePieceId(next?.id ?? null);
    }
  }

  const activeComputed = computed.pieces.find(p => p.piece.id === activePieceId);

  return (
    <div>
      <div className="estimate-header">
        <label>
          Job #
          <input
            value={project.jobNumber}
            placeholder="J####"
            onChange={(e) => updateHeader('jobNumber', e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Job name
          <input
            value={project.jobName}
            onChange={(e) => updateHeader('jobName', e.target.value)}
          />
        </label>
        <label>
          Estimator
          <input
            value={project.estimator}
            onChange={(e) => updateHeader('estimator', e.target.value)}
          />
        </label>
        <label>
          Description
          <input
            value={project.description}
            onChange={(e) => updateHeader('description', e.target.value)}
          />
        </label>
      </div>

      <div className="section-head">
        <h4>Sign pieces · {project.pieces.length}</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={adderType} onChange={(e) => setAdderType(e.target.value)} style={{ minWidth: 220 }}>
            {PIECE_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.status === 'todo' ? ' (math pending)' : ''}
              </option>
            ))}
          </select>
          <button className="primary" onClick={addPiece}>+ Add piece</button>
        </div>
      </div>

      {project.pieces.length === 0 ? (
        <p className="muted">No pieces yet. Pick a type above and click <b>+ Add piece</b>.</p>
      ) : (
        <div className="pieces-grid">
          <div className="piece-list">
            {computed.pieces.map(p => (
              <div
                key={p.piece.id}
                className={`pi ${p.piece.id === activePieceId ? 'active' : ''}`}
                onClick={() => setActivePieceId(p.piece.id)}
              >
                <div className="pi-type">{p.type.label}</div>
                <div className="pi-meta">{p.sqft > 0 ? `${round2(p.sqft)} sqft` : '—'}</div>
                <div className="pi-total">${round2(p.total).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {activeComputed && (
            <PieceEditor
              piece={activeComputed.piece}
              computed={activeComputed}
              catalog={catalog}
              workCodes={workCodes}
              onChange={updatePiece}
              onRemove={() => removePiece(activeComputed.piece.id)}
            />
          )}
        </div>
      )}

      <div className="totals-bar">
        <div><span className="label">Materials</span> ${round2(computed.materialTotal).toLocaleString()}</div>
        <div><span className="label">Labor</span> ${round2(computed.laborTotal).toLocaleString()}</div>
        <div className="grand-total">${round2(computed.total).toLocaleString()}</div>
      </div>
    </div>
  );
}
