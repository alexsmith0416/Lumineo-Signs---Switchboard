import { useMemo, useState } from 'react';

import { computeDesign, type DesignInput, type DesignResult } from '../lib/engine';
import { fmt, fmtFtIn, fmtInches } from './fields';
import { SHAPE_LABELS } from '../data/tables';
import { SKETCH_PALETTES, SketchSvg, sketchAvailable } from './SketchSvg';
import type { Theme } from './useTheme';

// Elevation sketch view: the shared SketchSvg drawing plus a summary KPI
// strip. Inputs stay in the left column, so the drawing updates live.

interface Props {
  input: DesignInput;
  result: DesignResult;
  theme: Theme;
  onChange: (next: DesignInput) => void;
}

export function SketchPanel({ input, result: committed, theme, onChange }: Props) {
  const [selected, setSelected] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // While dragging, recompute locally instead of writing to app state on every
  // pointer move — that keeps every piece length live without thrashing the
  // autosave. The move is committed on pointer-up.
  const [dragFt, setDragFt] = useState<number | null>(null);

  const editingSegmentId =
    editingIndex !== null ? (input.transition.segments[editingIndex - 1]?.id ?? null) : null;

  const withDrag = useMemo((): DesignInput => {
    if (dragFt === null || !editingSegmentId) return input;
    return {
      ...input,
      transition: {
        ...input.transition,
        segments: input.transition.segments.map((s) =>
          s.id === editingSegmentId ? { ...s, spliceFt: dragFt, anchorFaceId: null } : s,
        ),
      },
    };
  }, [input, dragFt, editingSegmentId]);

  const result = useMemo(
    () => (dragFt === null ? committed : computeDesign(withDrag)),
    [committed, dragFt, withDrag],
  );

  const commitDrag = () => {
    if (dragFt !== null) onChange(withDrag);
    setDragFt(null);
  };

  if (!sketchAvailable(result)) {
    return (
      <div className="results-col">
        <div className="panel empty-state">
          <p>Enter the sign face dimensions on the left — the elevation sketch draws itself from the calculated design.</p>
        </div>
      </div>
    );
  }

  const section = result.column.section!;
  const footing = result.footing!;
  const faces = result.elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const topMax = Math.max(...faces.map((f) => f.topFt));

  const transitionSegments = result.poleSegments.filter((s) => !s.isBase && s.section);

  const poleLabel = `${input.numColumns} × ${SHAPE_LABELS[input.columnType].short.toLowerCase()} ${section.name}`;
  const footingLabel =
    input.footingType === 'round'
      ? `${input.numFootings} × Ø ${fmtInches(footing.diameterFt)} caisson`
      : `${input.numFootings} × ${fmt(footing.planWidthFt)}' × ${fmt(footing.planLengthFt)}' pier`;

  return (
    <div className="results-col">
      <section className="panel">
        <h2 className="panel-caption">Elevation Sketch</h2>
        <div className="panel-body sketch-body">
          <SketchSvg
            input={withDrag}
            result={result}
            palette={SKETCH_PALETTES[theme]}
            interaction={{
              selected,
              onSelectPole: () => setSelected(true),
              editingIndex,
              onSpliceDrag: setDragFt,
              onSpliceCommit: commitDrag,
              snapTo: faces.map((f) => Math.max(0, f.topFt - f.heightFt)),
            }}
          />
          {selected && (
            <div className="sketch-tools" role="group" aria-label="Pole structure">
              {transitionSegments.length === 0 ? (
                <>
                  <span className="sketch-tools__label">Pole selected</span>
                  <button
                    className="btn-soft"
                    onClick={() =>
                      onChange({
                        ...input,
                        transition: {
                          enabled: true,
                          segments: [
                            {
                              id: `tr-${Date.now().toString(36)}`,
                              spliceFt: null,
                              anchorFaceId: null,
                              sizing: 'auto',
                              sizeName: null,
                              customSection: { ...input.customSection },
                            },
                          ],
                        },
                      })
                    }
                  >
                    Add a transition
                  </button>
                </>
              ) : editingIndex === null ? (
                <>
                  <span className="sketch-tools__label">Pole selected</span>
                  {transitionSegments.map((seg) => (
                    <button key={seg.index} className="btn-soft" onClick={() => setEditingIndex(seg.index)}>
                      Edit transition location{transitionSegments.length > 1 ? ` (${seg.key})` : ''}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <span className="sketch-tools__label">
                    Drag the splice — snaps to full inches and cabinet bottoms
                  </span>
                  <button
                    className="btn-soft"
                    onClick={() => {
                      commitDrag();
                      setEditingIndex(null);
                    }}
                  >
                    Done
                  </button>
                </>
              )}
              <button
                className="btn-soft"
                onClick={() => {
                  setDragFt(null);
                  setEditingIndex(null);
                  setSelected(false);
                }}
              >
                {editingIndex === null ? 'Deselect' : 'Cancel'}
              </button>
            </div>
          )}

          <p className="hint sketch-note">
            Click the pole to move a transition. Proportions are to scale from
            the calculated design; very thin poles and footings are widened
            slightly so they stay visible. Elevation view — pier length runs
            perpendicular to the sign face.
          </p>
        </div>
      </section>

      <div className="kpi-row">
        <div className="kpi">
          <p className="kpi-caption">POLE</p>
          <p className="kpi-value sketch-kpi">{poleLabel}</p>
          <p className="kpi-foot">{fmt(section.odIn, 3)}" × {fmt(section.wallIn, 4)}" wall</p>
        </div>
        <div className="kpi">
          <p className="kpi-caption">FOOTING</p>
          <p className="kpi-value sketch-kpi">{fmtFtIn(footing.depthFt)} deep</p>
          <p className="kpi-foot">{footingLabel}</p>
        </div>
        <div className="kpi">
          <p className="kpi-caption">OVERALL HEIGHT</p>
          <p className="kpi-value sketch-kpi">{fmtFtIn(topMax)}</p>
          <p className="kpi-foot">{fmt(result.totalAreaSqFt, 1)} sq ft of sign</p>
        </div>
        <div className="kpi">
          <p className="kpi-caption">CONCRETE</p>
          <p className="kpi-value sketch-kpi">
            {fmt(Math.ceil((footing.totalVolumeYd3 + (result.mowPad?.volumeYd3 ?? 0)) * 2) / 2, 1)} yd³
          </p>
          <p className="kpi-foot">
            {result.mowPad ? 'footings + mow pad, order volume (±)' : 'order volume (±)'}
          </p>
        </div>
      </div>
    </div>
  );
}
