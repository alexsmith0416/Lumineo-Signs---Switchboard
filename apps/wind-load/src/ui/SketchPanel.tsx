import { useEffect, useMemo, useRef, useState } from 'react';

import { computeDesign, snapSpliceFt, type DesignInput, type DesignResult } from '../lib/engine';
import type { EditField, FacePatch, SketchPoint, SketchSelection } from './SketchSvg';
import { PopFtIn, fmt, fmtFtIn, fmtInches } from './fields';
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

/** Where the editing popover sits, in coordinates local to the drawing. */
interface Anchor {
  x: number;
  y: number;
  /** Set when the click was near an edge, so the card opens back towards it. */
  flipX: boolean;
  flipY: boolean;
}

/** Readouts snap to whole inches, so the fields show the same value. */
const toInch = (ft: number) => Math.round(ft * 12) / 12;

const POP_W = 240;
const POP_H = 180;
const MIN_FACE_FT = 0.5;

export function SketchPanel({ input, result: committed, theme, onChange }: Props) {
  const [selection, setSelection] = useState<SketchSelection>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingFaceId, setEditingFaceId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [focusField, setFocusField] = useState<EditField | null>(null);
  // Any drag previews into this input and recomputes locally; writing to app
  // state on every pointer move would thrash the autosave. Committed on up.
  const [preview, setPreview] = useState<DesignInput | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const shown = preview ?? input;
  const result = useMemo(
    () => (preview ? computeDesign(preview) : committed),
    [preview, committed],
  );

  const commit = () => {
    if (preview) onChange(preview);
    setPreview(null);
  };
  const cancel = () => {
    setPreview(null);
    setEditingIndex(null);
    setEditingFaceId(null);
    setSelection(null);
    setAnchor(null);
    setFocusField(null);
  };

  /** Apply the edit in progress and step back out of the editor. */
  const done = () => {
    commit();
    setEditingIndex(null);
    setEditingFaceId(null);
    setFocusField(null);
  };

  /** Keep whatever is staged and put the card away. */
  const close = () => {
    done();
    setSelection(null);
    setAnchor(null);
  };

  // Anything the drawing itself handles — picking a new target, grabbing a
  // handle, clicking a readout — keeps the card up; it is only a click with
  // nothing under it that dismisses. Capture phase, because those handlers
  // stop propagation before a bubbling listener would hear them.
  const HOLDS_CARD = '.sketch-pop, .sk-pole-hit, .sk-face-hit, .sk-face-move, .sk-num, .sk-handle, .sk-grip';
  useEffect(() => {
    if (!selection) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.(HOLDS_CARD)) return;
      close();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, editingIndex, editingFaceId, preview]);

  // Enter applies whatever is staged — a drag that has already landed or a
  // number just typed — and Escape backs out, like any other transient
  // surface. Enter on a button is left alone so it still presses the button.
  useEffect(() => {
    if (!selection) return;
    const editing = editingIndex !== null || editingFaceId !== null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancel();
        return;
      }
      if (e.key !== 'Enter' || !editing) return;
      if ((e.target as HTMLElement | null)?.closest?.('button')) return;
      e.preventDefault();
      done();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, editingIndex, editingFaceId, preview]);

  /** Client point → popover placement inside the drawing. */
  const place = (at: SketchPoint): Anchor | null => {
    const el = stageRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: at.x - r.left,
      y: at.y - r.top,
      flipX: at.x - r.left > r.width - POP_W - 24,
      flipY: at.y - r.top > r.height - POP_H - 24,
    };
  };

  const base = () => preview ?? input;

  const dragSplice = (ft: number) => {
    const segId = editingIndex !== null ? input.transition.segments[editingIndex - 1]?.id : null;
    if (!segId) return;
    const from = base();
    setPreview({
      ...from,
      transition: {
        ...from.transition,
        segments: from.transition.segments.map((s) =>
          s.id === segId ? { ...s, spliceFt: ft, anchorFaceId: null } : s,
        ),
      },
    });
  };

  const dragFace = (id: string, patch: FacePatch) => {
    const from = base();
    setPreview({
      ...from,
      elements: from.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    });
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

  const footing = result.footing!;
  const faces = result.elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const topMax = Math.max(...faces.map((f) => f.topFt));
  const faceBottoms = faces.map((f) => Math.max(0, f.topFt - f.heightFt));

  const transitionSegments = result.poleSegments.filter((s) => !s.isBase && s.section);

  const poleTiles = result.poleSegments.filter((s) => s.section);
  const footingLabel =
    input.footingType === 'round'
      ? `${input.numFootings} × Ø ${fmtInches(footing.diameterFt)} caisson`
      : `${input.numFootings} × ${fmt(footing.planWidthFt)}' × ${fmt(footing.planLengthFt)}' pier`;

  // Same travel limits the drag honours, so typing a splice lands in the same
  // place as dragging to it.
  const typeSplice = (ft: number) => {
    if (editingIndex === null) return;
    const segs = result.poleSegments;
    const minFt = Math.max(1, (segs[editingIndex - 1]?.spanBottomFt ?? 0) + 2);
    const maxFt = Math.min(topMax - 1, segs[editingIndex + 1]?.topFt ?? topMax - 1);
    dragSplice(snapSpliceFt(ft, faceBottoms, minFt, maxFt));
  };

  const editingFace = editingFaceId ? faces.find((f) => f.id === editingFaceId) ?? null : null;
  const editingSeg = editingIndex !== null ? result.poleSegments[editingIndex] ?? null : null;

  const addTransition = () =>
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
    });

  const popBody = () => {
    if (!selection) return null;

    if (selection.kind === 'pole') {
      if (transitionSegments.length === 0) {
        return (
          <>
            <p className="sketch-pop__title">Pole</p>
            <button className="btn-soft" onClick={addTransition}>Add a transition</button>
          </>
        );
      }
      if (editingSeg === null) {
        return (
          <>
            <p className="sketch-pop__title">Pole</p>
            {transitionSegments.map((seg) => (
              <button
                key={seg.index}
                className="btn-soft"
                onClick={() => {
                  setEditingIndex(seg.index);
                  setFocusField(null);
                }}
              >
                Edit transition {transitionSegments.length > 1 ? `${seg.key} ` : ''}location
              </button>
            ))}
          </>
        );
      }
      return (
        <>
          <p className="sketch-pop__title">Transition {editingSeg.key} at</p>
          <PopFtIn
            label="Height above grade"
            value={toInch(editingSeg.spanBottomFt)}
            onChange={typeSplice}
            onCommit={commit}
            autoFocus={focusField === 'splice'}
          />
          <p className="hint">
            Or drag the pill on the pole — snaps to full inches and cabinet
            bottoms. Press Enter to apply.
          </p>
          <button className="btn-soft" onClick={done}>Done</button>
        </>
      );
    }

    const face = faces.find((f) => f.id === selection.id);
    const name = shown.elements.find((e) => e.id === selection.id)?.label || 'Sign face';
    if (!face) return null;
    if (editingFace === null) {
      return (
        <>
          <p className="sketch-pop__title">{name}</p>
          <button
            className="btn-soft"
            onClick={() => {
              setEditingFaceId(face.id);
              setFocusField(null);
            }}
          >
            Edit size &amp; position
          </button>
        </>
      );
    }
    return (
      <>
        <p className="sketch-pop__title">{name}</p>
        <PopFtIn
          label="Width"
          value={toInch(editingFace.widthFt)}
          onChange={(v) => dragFace(editingFace.id, { widthFt: Math.max(MIN_FACE_FT, v) })}
          onCommit={commit}
          autoFocus={focusField === 'width'}
        />
        <PopFtIn
          label="Height"
          value={toInch(editingFace.heightFt)}
          onChange={(v) =>
            dragFace(editingFace.id, {
              heightFt: Math.min(Math.max(MIN_FACE_FT, v), editingFace.topFt),
            })
          }
          onCommit={commit}
          autoFocus={focusField === 'height'}
        />
        <PopFtIn
          label="Top of cabinet"
          value={toInch(editingFace.topFt)}
          onChange={(v) => dragFace(editingFace.id, { topFt: Math.max(editingFace.heightFt, v) })}
          onCommit={commit}
          autoFocus={focusField === 'top'}
        />
        <p className="hint">
          Or drag the box and its grips on the sketch. Press Enter to apply.
        </p>
        <button className="btn-soft" onClick={done}>Done</button>
      </>
    );
  };

  return (
    <div className="results-col">
      <section className="panel">
        <h2 className="panel-caption">Elevation Sketch</h2>
        <div className="panel-body sketch-body">
          <div className="sketch-stage" ref={stageRef}>
            <SketchSvg
              input={shown}
              result={result}
              palette={SKETCH_PALETTES[theme]}
              interaction={{
                selection,
                onSelectPole: (at) => {
                  setSelection({ kind: 'pole' });
                  setEditingFaceId(null);
                  setFocusField(null);
                  setAnchor(place(at));
                },
                onSelectFace: (id, at) => {
                  setSelection({ kind: 'face', id });
                  setEditingIndex(null);
                  setFocusField(null);
                  setAnchor(place(at));
                },
                onEditField: (field, at) => {
                  setFocusField(field);
                  setAnchor(place(at));
                },
                editingIndex,
                onSpliceDrag: dragSplice,
                editingFaceId,
                onFaceDrag: dragFace,
                onCommit: commit,
                snapTo: faceBottoms,
              }}
            />
            {selection && anchor && (
              <div
                className="sketch-pop"
                role="group"
                aria-label="Sketch editing"
                style={{
                  left: anchor.x,
                  top: anchor.y,
                  transform: `translate(${anchor.flipX ? 'calc(-100% - 14px)' : '14px'}, ${
                    anchor.flipY ? 'calc(-100% - 14px)' : '14px'
                  })`,
                }}
              >
                {popBody()}
                <button
                  className="btn-soft sketch-pop__close"
                  onClick={editingIndex === null && editingFaceId === null ? close : cancel}
                >
                  {editingIndex === null && editingFaceId === null ? 'Close' : 'Cancel'}
                </button>
              </div>
            )}
          </div>

          <p className="hint sketch-note">
            Click the pole to move a transition, or a cabinet to move and
            resize it — the editing card opens where you click, and any
            underlined measurement can be typed instead of dragged. Enter or a
            click off the drawing applies the change and closes the card;
            Escape discards it. Proportions
            are to scale from the calculated design; very thin poles and
            footings are widened slightly so they stay visible. Elevation view —
            pier length runs perpendicular to the sign face.
          </p>
        </div>
      </section>

      <div className="kpi-row kpi-row--pieces">
        {/* One tile per pole piece, keyed and labelled to match the sketch legend. */}
        {poleTiles.map((s) => (
          <div className="kpi" key={s.index}>
            <p className="kpi-caption">
              <span className="seg-key">{s.key}</span>
              {s.label.toUpperCase()}
            </p>
            <p className="kpi-value sketch-kpi">
              {input.numColumns} × {SHAPE_LABELS[input.columnType].short} {s.section!.name}
            </p>
            <p className="kpi-foot">
              {fmtFtIn(s.lengthFt)} long · {fmt(s.section!.odIn, 3)}" × {fmt(s.section!.wallIn, 4)}" wall
            </p>
          </div>
        ))}
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
