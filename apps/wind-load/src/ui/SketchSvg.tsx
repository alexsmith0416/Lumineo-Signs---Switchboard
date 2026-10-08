import type { DesignInput, DesignResult } from '../lib/engine';
import { useRef } from 'react';
import { snapSpliceFt } from '../lib/engine';
import { SHAPE_LABELS } from '../data/tables';
import { fmt, fmtFtIn, fmtInches } from './fields';

// Pure elevation-sketch SVG: sign faces as boxes on the pole(s), footings
// hatched in below grade, dimension lines for overall height and embedment.
// Colors come in through a palette prop (concrete hex values rather than CSS
// variables) so the same component renders on screen (theme palettes below)
// AND serializes to a standalone SVG for the PDF export, where stylesheets
// aren't available.

export interface SketchPalette {
  earth: string;
  hatch: string;
  grade: string;
  gradeLabel: string;
  footingFill: string;
  footingStroke: string;
  pole: string;
  plate: string;
  faceFill: string;
  faceStroke: string;
  faceName: string;
  faceDims: string;
  dim: string;
  dimLabel: string;
  ext: string;
  callout: string;
  legendBg: string;
  legendBorder: string;
  keyBg: string;
  keyText: string;
}

// Values mirror the Switchboard design tokens (DESIGN.md §2) per theme.
export const SKETCH_PALETTES: Record<'light' | 'dark', SketchPalette> = {
  light: {
    earth: '#f4f5f8',
    hatch: '#e4e5ea',
    grade: '#1f1f2e',
    gradeLabel: '#8b91a3',
    footingFill: '#ffffff',
    footingStroke: '#4a4f5e',
    pole: '#4a4f5e',
    plate: '#1f1f2e',
    faceFill: '#e8eaf5',
    faceStroke: '#141464',
    faceName: '#141464',
    faceDims: '#4a4f5e',
    dim: '#8b91a3',
    dimLabel: '#1f1f2e',
    ext: '#d4d5da',
    callout: '#1f1f2e',
    legendBg: '#ffffff',
    legendBorder: '#e4e5ea',
    keyBg: '#141464',
    keyText: '#ffffff',
  },
  dark: {
    earth: '#131734',
    hatch: '#2a3056',
    grade: '#f3f4f8',
    gradeLabel: '#7b82a0',
    footingFill: '#1a1f3d',
    footingStroke: '#b3b8cc',
    pole: '#b3b8cc',
    plate: '#f3f4f8',
    faceFill: '#2a3260',
    faceStroke: '#7388ff',
    faceName: '#9fb0ff',
    faceDims: '#b3b8cc',
    dim: '#7b82a0',
    dimLabel: '#f3f4f8',
    ext: '#2a3056',
    callout: '#f3f4f8',
    legendBg: '#1a1f3d',
    legendBorder: '#2a3056',
    keyBg: '#7388ff',
    keyText: '#0b0e1f',
  },
};

export const SKETCH_VB_W = 760;
export const SKETCH_VB_H = 620;
const PAD_L = 118;
const PAD_R = 118;
const PAD_T = 40;
const PAD_B = 56;
const FONT = "'Open Sans', Helvetica, Arial, sans-serif";

/** Even pole/footing positions across the widest face (centered strips). */
function layoutXs(count: number, widthFt: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -widthFt / 2 + (widthFt * (i + 0.5)) / count);
}

/** True when the design is complete enough to draw. */
export function sketchAvailable(result: DesignResult): boolean {
  return (
    result.elements.some((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0) &&
    result.column.section !== null &&
    result.footing !== null &&
    result.footing.depthFt > 0
  );
}

export type SketchSelection = { kind: 'pole' } | { kind: 'face'; id: string } | null;

/** Which edge of a cabinet is being dragged ('move' = the whole box). */
export type FaceHandle = 'move' | 'top' | 'bottom' | 'left' | 'right';

export interface FacePatch {
  topFt?: number;
  heightFt?: number;
  widthFt?: number;
}

export interface SketchInteraction {
  selection: SketchSelection;
  onSelectPole: () => void;
  onSelectFace: (id: string) => void;
  /** Pole segment whose splice is armed for dragging, or null. */
  editingIndex: number | null;
  onSpliceDrag: (ft: number) => void;
  /** Cabinet armed for move/resize, or null. */
  editingFaceId: string | null;
  onFaceDrag: (id: string, patch: FacePatch) => void;
  /** Fired on pointer-up at the end of any drag. */
  onCommit: () => void;
  /** Elevations a dragged splice snaps onto (cabinet bottoms). */
  snapTo: readonly number[];
}

interface Props {
  input: DesignInput;
  result: DesignResult;
  palette: SketchPalette;
  /** Omitted for static renders (the PDF export). */
  interaction?: SketchInteraction;
  /** Solid background fill (for export); omit for transparent on-screen use. */
  background?: string;
  /** Unique pattern-id prefix if multiple sketches are mounted at once. */
  idPrefix?: string;
}

const LEGEND_ROW_H = 16;
const LEGEND_PAD = 9;

export function SketchSvg({ input, result, palette: p, background, idPrefix = 'sk', interaction }: Props) {
  const faces = result.elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const section = result.column.section!;
  const footing = result.footing!;
  const segments = result.poleSegments;

  const topMax = Math.max(...faces.map((f) => f.topFt));
  const widest = Math.max(...faces.map((f) => f.widthFt));
  const depth = footing.depthFt;
  const footWFt = input.footingType === 'round' ? footing.diameterFt : footing.planWidthFt;

  const poleXs = layoutXs(input.numColumns, widest);
  const footXs = layoutXs(input.numFootings, widest);

  const mowPad = input.mowPad.enabled ? result.mowPad : null;

  // Widest pole piece governs the horizontal extent.
  const maxPoleWFt = Math.max(
    ...segments.map((s) => (s.section ? s.section.odIn / 12 : 0)),
    section.odIn / 12,
  );
  const maxHalfX = Math.max(
    widest / 2,
    ...footXs.map((x) => Math.abs(x) + footWFt / 2),
    ...poleXs.map((x) => Math.abs(x) + maxPoleWFt / 2),
    mowPad ? input.mowPad.lengthFt / 2 : 0,
  );

  // A legend band across the top keeps the piece call-outs off the cabinets.
  const legendRows = segments.filter((s) => s.section).length;
  const legendH = legendRows ? LEGEND_PAD * 2 + legendRows * LEGEND_ROW_H : 0;
  const drawTop = PAD_T + legendH;

  const scale = Math.min(
    (SKETCH_VB_H - drawTop - PAD_B) / (topMax + depth),
    (SKETCH_VB_W - PAD_L - PAD_R) / (2 * maxHalfX),
  );

  const cx = SKETCH_VB_W / 2;
  const gradeY = drawTop + topMax * scale;
  const footBotY = gradeY + depth * scale;
  const X = (ft: number) => cx + ft * scale;
  const Y = (ftAboveGrade: number) => gradeY - ftAboveGrade * scale;

  const footWpx = Math.max(footWFt * scale, 16);
  const dimX = X(maxHalfX) + 30;
  const dimLX = X(-maxHalfX) - 30;
  const keyX = X(-maxHalfX) - 14;

  const footingLabel =
    input.footingType === 'round'
      ? `${input.numFootings} × Ø ${fmtInches(footing.diameterFt)} caisson`
      : `${input.numFootings} × ${fmt(footing.planWidthFt)}' × ${fmt(footing.planLengthFt)}' pier`;

  const earthId = `${idPrefix}-earth`;
  const concId = `${idPrefix}-conc`;

  const pxWidth = (s: typeof segments[number]) =>
    Math.max((s.section ? s.section.odIn / 12 : 0) * scale, 7);

  // Pointer → drawing coordinates. The viewBox scales uniformly to the
  // rendered width, so one ratio converts a client point back to feet.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { kind: 'splice' }
    | { kind: 'face'; id: string; handle: FaceHandle; grabFt: number }
    | null
  >(null);

  const toViewBox = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * SKETCH_VB_W,
      y: ((clientY - rect.top) / rect.height) * SKETCH_VB_H,
    };
  };
  const elevationAt = (clientY: number) => (gradeY - toViewBox(0, clientY).y) / scale;
  const halfWidthAt = (clientX: number) => Math.abs(toViewBox(clientX, 0).x - cx) / scale;
  const snapInch = (ft: number) => Math.round(ft * 12) / 12;

  const editing =
    interaction && interaction.editingIndex !== null
      ? segments[interaction.editingIndex] ?? null
      : null;

  const dragSplice = (clientY: number) => {
    if (!interaction || !editing) return;
    const minFt = Math.max(1, (segments[editing.index - 1]?.spanBottomFt ?? 0) + 2);
    const maxFt = Math.min(topMax - 1, segments[editing.index + 1]?.topFt ?? topMax - 1);
    interaction.onSpliceDrag(snapSpliceFt(elevationAt(clientY), interaction.snapTo, minFt, maxFt));
  };

  const MIN_FACE_FT = 0.5;
  const dragFace = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!interaction || !d || d.kind !== 'face') return;
    const face = faces.find((f) => f.id === d.id);
    if (!face) return;
    const bottom = Math.max(0, face.topFt - face.heightFt);

    if (d.handle === 'left' || d.handle === 'right') {
      interaction.onFaceDrag(d.id, {
        widthFt: Math.max(MIN_FACE_FT, snapInch(2 * halfWidthAt(clientX))),
      });
      return;
    }
    const at = snapInch(elevationAt(clientY) - d.grabFt);
    if (d.handle === 'move') {
      // Keep the box the same size; never let it sink below grade.
      interaction.onFaceDrag(d.id, { topFt: Math.max(face.heightFt, at) });
    } else if (d.handle === 'top') {
      const top = Math.max(bottom + MIN_FACE_FT, at);
      interaction.onFaceDrag(d.id, { topFt: top, heightFt: top - bottom });
    } else {
      const newBottom = Math.min(Math.max(0, at), face.topFt - MIN_FACE_FT);
      interaction.onFaceDrag(d.id, { heightFt: face.topFt - newBottom });
    }
  };

  const beginFaceDrag = (
    e: React.PointerEvent,
    id: string,
    handle: FaceHandle,
    topFt: number,
  ) => {
    if (!interaction || interaction.editingFaceId !== id) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const ref = handle === 'bottom' ? Math.max(0, topFt - (faces.find((f) => f.id === id)?.heightFt ?? 0)) : topFt;
    dragRef.current = { kind: 'face', id, handle, grabFt: elevationAt(e.clientY) - ref };
  };

  return (
    <svg
      ref={svgRef}
      onPointerMove={(e) => {
        if (e.buttons !== 1 || !dragRef.current) return;
        if (dragRef.current.kind === 'splice') dragSplice(e.clientY);
        else dragFace(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        if (!dragRef.current) return;
        dragRef.current = null;
        interaction?.onCommit();
      }}
      className={`sketch-svg${interaction?.selection ? ' is-selected' : ''}${
        editing || interaction?.editingFaceId ? ' is-editing' : ''
      }`}
      viewBox={`0 0 ${SKETCH_VB_W} ${SKETCH_VB_H}`}
      width={SKETCH_VB_W}
      height={SKETCH_VB_H}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Elevation sketch of the sign structure"
      style={{ fontFamily: FONT }}
    >
      <defs>
        <pattern id={earthId} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke={p.hatch} strokeWidth="1" />
        </pattern>
        <pattern id={concId} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke={p.hatch} strokeWidth="1" />
        </pattern>
      </defs>

      {background && <rect x={0} y={0} width={SKETCH_VB_W} height={SKETCH_VB_H} fill={background} />}

      {/* Pole legend — keeps piece call-outs clear of the cabinets */}
      {legendRows > 0 && (
        <g>
          <rect
            x={16}
            y={12}
            width={SKETCH_VB_W - 32}
            height={legendH}
            rx={6}
            fill={p.legendBg}
            stroke={p.legendBorder}
            strokeWidth={1}
          />
          {segments
            .filter((s) => s.section)
            .map((s, row) => {
              const y = 12 + LEGEND_PAD + row * LEGEND_ROW_H + 11;
              return (
                <g key={s.index}>
                  <rect x={26} y={y - 9} width={14} height={13} rx={3} fill={p.keyBg} />
                  <text x={33} y={y + 1} textAnchor="middle" fill={p.keyText} fontSize={9} fontWeight={800}>
                    {s.key}
                  </text>
                  <text x={48} y={y + 1} fill={p.callout} fontSize={11} fontWeight={700}>
                    {s.label}
                  </text>
                  <text x={160} y={y + 1} fill={p.callout} fontSize={11} fontWeight={700}>
                    {input.numColumns} × {SHAPE_LABELS[input.columnType].short} {s.section!.name}
                  </text>
                  <text x={360} y={y + 1} fill={p.faceDims} fontSize={11} fontWeight={700}>
                    {fmtFtIn(s.lengthFt)} long
                  </text>
                  <text x={450} y={y + 1} fill={p.gradeLabel} fontSize={10} fontWeight={700}>
                    {s.isBase
                      ? `${fmtFtIn(Math.max(0, -s.spanBottomFt))} embedded · to ${fmtFtIn(s.topFt)}`
                      : `splice ${fmtFtIn(s.spanBottomFt)} · ${fmt(s.overlapFt)}' sleeved in · to ${fmtFtIn(s.topFt)}`}
                  </text>
                </g>
              );
            })}
        </g>
      )}

      {/* Earth below grade */}
      <rect x={0} y={gradeY} width={SKETCH_VB_W} height={SKETCH_VB_H - gradeY} fill={p.earth} />
      <rect x={0} y={gradeY} width={SKETCH_VB_W} height={SKETCH_VB_H - gradeY} fill={`url(#${earthId})`} />

      {/* Footings */}
      {footXs.map((fx, i) => (
        <g key={`f-${i}`}>
          <rect
            x={X(fx) - footWpx / 2}
            y={gradeY}
            width={footWpx}
            height={footBotY - gradeY}
            fill={p.footingFill}
            stroke={p.footingStroke}
            strokeWidth={1.5}
          />
          <rect x={X(fx) - footWpx / 2} y={gradeY} width={footWpx} height={footBotY - gradeY} fill={`url(#${concId})`} />
        </g>
      ))}

      {/* Mow pad: concrete apron sitting on top of the soil */}
      {mowPad && (() => {
        const padWpx = input.mowPad.lengthFt * scale;
        const padHpx = Math.max((input.mowPad.heightIn / 12) * scale, 4);
        return (
          <g>
            <rect x={cx - padWpx / 2} y={gradeY - padHpx} width={padWpx} height={padHpx} fill={p.footingFill} stroke={p.footingStroke} strokeWidth={1.5} />
            <rect x={cx - padWpx / 2} y={gradeY - padHpx} width={padWpx} height={padHpx} fill={`url(#${concId})`} />
          </g>
        );
      })()}

      {/* Sign faces — boxes first; their labels are drawn after the poles */}
      {faces.map((f) => {
        const bot = Math.max(0, f.topFt - f.heightFt);
        const hPx = (f.topFt - bot) * scale;
        const wPx = f.widthFt * scale;
        const isSel = interaction?.selection?.kind === 'face' && interaction.selection.id === f.id;
        const isEditing = interaction?.editingFaceId === f.id;
        return (
          <g key={f.id}>
            <rect
              x={X(-f.widthFt / 2)}
              y={Y(f.topFt)}
              width={wPx}
              height={hPx}
              fill={p.faceFill}
              stroke={p.faceStroke}
              strokeWidth={isSel ? 2.4 : 1.5}
              className={interaction ? (isEditing ? 'sk-face-move' : 'sk-face-hit') : undefined}
              onPointerDown={
                interaction
                  ? (e) => {
                      e.stopPropagation();
                      interaction.onSelectFace(f.id);
                      beginFaceDrag(e, f.id, 'move', f.topFt);
                    }
                  : undefined
              }
            />
            {isSel && !isEditing && (
              <rect
                x={X(-f.widthFt / 2) - 3}
                y={Y(f.topFt) - 3}
                width={wPx + 6}
                height={hPx + 6}
                rx={2}
                fill="none"
                stroke={p.keyBg}
                strokeWidth={1.4}
                strokeDasharray="5 3"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* Pole pieces — on top of the cabinets so the full run reads, each
          transition stacked on the one below with its sleeved 2 ft dashed. */}
      <g
        className={interaction ? 'sk-pole-hit' : undefined}
        onPointerDown={
          interaction
            ? (e) => {
                e.stopPropagation();
                interaction.onSelectPole();
              }
            : undefined
        }
      >
      {poleXs.map((px, col) =>
        segments.map((s) => {
          const w = pxWidth(s);
          const topY = Y(s.topFt);
          const bodyBotY = Y(s.spanBottomFt);
          const sleeveBotY = Y(s.spanBottomFt - s.overlapFt);
          return (
            <g key={`p-${col}-${s.index}`}>
              <rect x={X(px) - w / 2} y={topY} width={w} height={Math.max(1, bodyBotY - topY)} fill={p.pole} />
              {s.overlapFt > 0 && (
                <rect
                  x={X(px) - w / 2}
                  y={bodyBotY}
                  width={w}
                  height={Math.max(1, sleeveBotY - bodyBotY)}
                  fill="none"
                  stroke={p.keyBg}
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                />
              )}
              {!s.isBase && (
                <line
                  x1={X(px) - w / 2 - 5}
                  y1={bodyBotY}
                  x2={X(px) + w / 2 + 5}
                  y2={bodyBotY}
                  stroke={p.plate}
                  strokeWidth={2}
                />
              )}
              {interaction?.selection?.kind === 'pole' && (
                <rect
                  x={X(px) - w / 2 - 2}
                  y={topY - 2}
                  width={w + 4}
                  height={Math.max(1, sleeveBotY - topY) + 4}
                  rx={2}
                  fill="none"
                  stroke={p.keyBg}
                  strokeWidth={1.4}
                  strokeDasharray="5 3"
                />
              )}
            </g>
          );
        }),
      )}
      </g>

      {/* Base plates + anchor bolts */}
      {input.basePlate.enabled &&
        poleXs.map((px, i) => {
          const w = pxWidth(segments[0] ?? { section } as typeof segments[number]);
          return (
            <g key={`bp-${i}`}>
              <rect x={X(px) - w * 1.15} y={gradeY - 4} width={w * 2.3} height={5} fill={p.plate} />
              <line x1={X(px) - w * 0.85} y1={gradeY} x2={X(px) - w * 0.85} y2={gradeY + 22} stroke={p.plate} strokeWidth={2} strokeDasharray="3 2" />
              <line x1={X(px) + w * 0.85} y1={gradeY} x2={X(px) + w * 0.85} y2={gradeY + 22} stroke={p.plate} strokeWidth={2} strokeDasharray="3 2" />
            </g>
          );
        })}

      {/* Sign face labels — last, with a backing chip so the pole behind them
          can never swallow the text. */}
      {faces.map((f) => {
        const bot = Math.max(0, f.topFt - f.heightFt);
        const hPx = (f.topFt - bot) * scale;
        const wPx = f.widthFt * scale;
        const boxY = Y(f.topFt);
        const name = f.label || 'Sign face';
        const dims = `${fmtFtIn(f.widthFt)} × ${fmtFtIn(f.heightFt)}`;
        const twoLine = hPx >= 34 && wPx >= 110;
        const chipW = Math.min(wPx - 6, Math.max(name.length * 7.2, dims.length * 7, 70));
        const chipH = twoLine ? 30 : 16;
        const cyMid = boxY + hPx / 2;
        if (wPx < 34 || hPx < 14) return null;
        return (
          <g key={`lbl-${f.id}`} pointerEvents="none">
            <rect
              x={cx - chipW / 2}
              y={cyMid - chipH / 2}
              width={chipW}
              height={chipH}
              rx={3}
              fill={p.faceFill}
              opacity={0.94}
            />
            {twoLine ? (
              <>
                <text x={cx} y={cyMid - 3} textAnchor="middle" fill={p.faceName} fontSize={13} fontWeight={800}>
                  {name}
                </text>
                <text x={cx} y={cyMid + 11} textAnchor="middle" fill={p.faceDims} fontSize={12} fontWeight={700}>
                  {dims}
                </text>
              </>
            ) : (
              <text x={cx} y={cyMid + 4} textAnchor="middle" fill={p.faceDims} fontSize={12} fontWeight={700}>
                {dims}
              </text>
            )}
          </g>
        );
      })}

      {/* Grade line + label */}
      <line x1={0} y1={gradeY} x2={SKETCH_VB_W} y2={gradeY} stroke={p.grade} strokeWidth={2} />
      <text x={10} y={gradeY - 6} fill={p.gradeLabel} fontSize={10} fontWeight={800} letterSpacing="1">GRADE</text>

      {/* Piece keys, parked clear of the sign with a thin leader */}
      {segments
        .filter((s) => s.section)
        .map((s) => {
          const visibleBottom = Math.max(s.spanBottomFt, 0);
          const midFt = Math.min(Math.max((visibleBottom + s.topFt) / 2, 0.4), topMax);
          const y = Y(midFt);
          const leftPole = X(poleXs[0]) - pxWidth(s) / 2;
          return (
            <g key={`key-${s.index}`}>
              <line x1={keyX + 8} y1={y} x2={leftPole} y2={y} stroke={p.ext} strokeWidth={1} strokeDasharray="3 3" />
              <rect x={keyX - 7} y={y - 7} width={15} height={14} rx={3} fill={p.keyBg} />
              <text x={keyX + 0.5} y={y + 3.5} textAnchor="middle" fill={p.keyText} fontSize={9.5} fontWeight={800}>
                {s.key}
              </text>
            </g>
          );
        })}

      {/* Extension + dimension lines: OAH right, embed left */}
      <line x1={X(widest / 2)} y1={Y(topMax)} x2={dimX + 5} y2={Y(topMax)} stroke={p.ext} strokeWidth={1} strokeDasharray="4 3" />
      <line x1={X(maxHalfX)} y1={gradeY} x2={dimX + 5} y2={gradeY} stroke={p.ext} strokeWidth={1} strokeDasharray="4 3" />
      <g>
        <line x1={dimX} y1={Y(topMax)} x2={dimX} y2={gradeY} stroke={p.dim} strokeWidth={1} />
        <line x1={dimX - 5} y1={Y(topMax)} x2={dimX + 5} y2={Y(topMax)} stroke={p.dim} strokeWidth={1} />
        <line x1={dimX - 5} y1={gradeY} x2={dimX + 5} y2={gradeY} stroke={p.dim} strokeWidth={1} />
        <text x={dimX + 8} y={(Y(topMax) + gradeY) / 2} fill={p.dimLabel} fontSize={12} fontWeight={800} dominantBaseline="middle">
          {fmtFtIn(topMax)} OAH
        </text>
      </g>

      <line x1={X(-maxHalfX)} y1={footBotY} x2={dimLX - 5} y2={footBotY} stroke={p.ext} strokeWidth={1} strokeDasharray="4 3" />
      <g>
        <line x1={dimLX} y1={gradeY} x2={dimLX} y2={footBotY} stroke={p.dim} strokeWidth={1} />
        <line x1={dimLX - 5} y1={gradeY} x2={dimLX + 5} y2={gradeY} stroke={p.dim} strokeWidth={1} />
        <line x1={dimLX - 5} y1={footBotY} x2={dimLX + 5} y2={footBotY} stroke={p.dim} strokeWidth={1} />
        <text x={dimLX - 8} y={(gradeY + footBotY) / 2} fill={p.dimLabel} fontSize={12} fontWeight={800} textAnchor="end" dominantBaseline="middle">
          {fmtFtIn(depth)} embed
        </text>
      </g>

      {/* Cabinet resize handles — top/bottom change height, sides change width */}
      {interaction?.editingFaceId &&
        (() => {
          const f = faces.find((x) => x.id === interaction.editingFaceId);
          if (!f) return null;
          const bot = Math.max(0, f.topFt - f.heightFt);
          const topY = Y(f.topFt);
          const botY = Y(bot);
          const lx = X(-f.widthFt / 2);
          const rx = X(f.widthFt / 2);
          const midY = (topY + botY) / 2;
          const grip = (
            key: string,
            x: number,
            y: number,
            handle: FaceHandle,
            cursor: string,
          ) => (
            <rect
              key={key}
              x={x - 5}
              y={y - 5}
              width={10}
              height={10}
              rx={2}
              fill={p.keyBg}
              stroke={p.keyText}
              strokeWidth={1}
              style={{ cursor }}
              onPointerDown={(e) => beginFaceDrag(e, f.id, handle, f.topFt)}
            />
          );
          return (
            <g>
              <rect
                x={lx}
                y={topY}
                width={rx - lx}
                height={botY - topY}
                fill="none"
                stroke={p.keyBg}
                strokeWidth={1.4}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
              {grip('t', cx, topY, 'top', 'ns-resize')}
              {grip('b', cx, botY, 'bottom', 'ns-resize')}
              {grip('l', lx, midY, 'left', 'ew-resize')}
              {grip('r', rx, midY, 'right', 'ew-resize')}
              <text
                x={rx + 12}
                y={midY + 4}
                fill={p.callout}
                fontSize={11}
                fontWeight={800}
                pointerEvents="none"
              >
                {fmtFtIn(f.widthFt)} × {fmtFtIn(f.heightFt)} · top {fmtFtIn(f.topFt)}
              </text>
            </g>
          );
        })()}

      {/* Splice drag handle — appears once a transition is picked for editing */}
      {editing && interaction && (
        <g>
          {interaction.snapTo
            .filter((b) => b > 0.5 && b < topMax)
            .map((b) => (
              <line
                key={`snap-${b}`}
                x1={X(-maxHalfX) - 6}
                y1={Y(b)}
                x2={X(maxHalfX) + 6}
                y2={Y(b)}
                stroke={p.keyBg}
                strokeWidth={1}
                strokeDasharray="2 5"
                opacity={0.5}
              />
            ))}
          <line
            x1={X(-maxHalfX) - 6}
            y1={Y(editing.spanBottomFt)}
            x2={X(maxHalfX) + 6}
            y2={Y(editing.spanBottomFt)}
            stroke={p.keyBg}
            strokeWidth={1.4}
          />
          <g
            className="sk-handle"
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.target as Element).setPointerCapture?.(e.pointerId);
              dragRef.current = { kind: 'splice' };
            }}
          >
            <rect
              x={X(poleXs[poleXs.length - 1]) + pxWidth(editing) / 2 + 8}
              y={Y(editing.spanBottomFt) - 11}
              width={92}
              height={22}
              rx={11}
              fill={p.keyBg}
            />
            {/* Grip arrows, drawn rather than typed — the ↕ glyph has no
                fallback in the SVG font stack and renders as a colon. */}
            {(() => {
              const gx = X(poleXs[poleXs.length - 1]) + pxWidth(editing) / 2 + 20;
              const gy = Y(editing.spanBottomFt);
              return (
                <path
                  d={`M${gx} ${gy - 7} l4 5 h-8 z M${gx} ${gy + 7} l4 -5 h-8 z`}
                  fill={p.keyText}
                />
              );
            })()}
            <text
              x={X(poleXs[poleXs.length - 1]) + pxWidth(editing) / 2 + 58}
              y={Y(editing.spanBottomFt) + 4}
              textAnchor="middle"
              fill={p.keyText}
              fontSize={11}
              fontWeight={800}
            >
              {fmtFtIn(editing.spanBottomFt)}
            </text>
          </g>
        </g>
      )}

      {/* Footing label */}
      <text x={cx} y={footBotY + 18} textAnchor="middle" fill={p.callout} fontSize={12} fontWeight={700}>
        {footingLabel} · {fmtFtIn(depth)} deep
      </text>
    </svg>
  );
}
