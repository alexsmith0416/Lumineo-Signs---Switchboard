import type { DesignInput, DesignResult } from '../lib/engine';
import { fmt, fmtFtIn } from './fields';

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

interface Props {
  input: DesignInput;
  result: DesignResult;
  palette: SketchPalette;
  /** Solid background fill (for export); omit for transparent on-screen use. */
  background?: string;
  /** Unique pattern-id prefix if multiple sketches are mounted at once. */
  idPrefix?: string;
}

export function SketchSvg({ input, result, palette: p, background, idPrefix = 'sk' }: Props) {
  const faces = result.elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const section = result.column.section!;
  const footing = result.footing!;

  const topMax = Math.max(...faces.map((f) => f.topFt));
  const widest = Math.max(...faces.map((f) => f.widthFt));
  const depth = footing.depthFt;
  const footWFt = input.footingType === 'round' ? input.caissonDiaFt : input.pierWidthFt;
  const poleWFt = section.odIn / 12;

  const poleXs = layoutXs(input.numColumns, widest);
  const footXs = layoutXs(input.numFootings, widest);

  const maxHalfX = Math.max(
    widest / 2,
    ...footXs.map((x) => Math.abs(x) + footWFt / 2),
    ...poleXs.map((x) => Math.abs(x) + poleWFt / 2),
  );
  const scale = Math.min(
    (SKETCH_VB_H - PAD_T - PAD_B) / (topMax + depth),
    (SKETCH_VB_W - PAD_L - PAD_R) / (2 * maxHalfX),
  );

  const cx = SKETCH_VB_W / 2;
  const gradeY = PAD_T + topMax * scale;
  const footBotY = gradeY + depth * scale;
  const X = (ft: number) => cx + ft * scale;
  const Y = (ftAboveGrade: number) => gradeY - ftAboveGrade * scale;

  const poleWpx = Math.max(poleWFt * scale, 7);
  const footWpx = Math.max(footWFt * scale, 16);
  const lowestFaceBottom = Math.min(...faces.map((f) => Math.max(0, f.topFt - f.heightFt)));
  const dimX = X(maxHalfX) + 30;
  const dimLX = X(-maxHalfX) - 30;

  const poleLabel = `${input.numColumns} × ${input.columnType === 'P' ? 'pipe' : 'tube'} ${section.name}`;
  const footingLabel =
    input.footingType === 'round'
      ? `${input.numFootings} × Ø ${fmt(input.caissonDiaFt)}' caisson`
      : `${input.numFootings} × ${fmt(input.pierWidthFt)}' × ${fmt(input.pierLengthFt)}' pier`;

  const earthId = `${idPrefix}-earth`;
  const concId = `${idPrefix}-conc`;

  return (
    <svg
      className="sketch-svg"
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

      {/* Poles (embedded to 3" above footing bottom, or stopped on base plates) */}
      {poleXs.map((px, i) => {
        const topY = Y(topMax);
        const botY = input.basePlate.enabled ? gradeY : footBotY - Math.min(6, 0.25 * scale);
        return <rect key={`p-${i}`} x={X(px) - poleWpx / 2} y={topY} width={poleWpx} height={botY - topY} fill={p.pole} />;
      })}

      {/* Base plates + anchor bolts */}
      {input.basePlate.enabled &&
        poleXs.map((px, i) => (
          <g key={`bp-${i}`}>
            <rect x={X(px) - poleWpx * 1.15} y={gradeY - 4} width={poleWpx * 2.3} height={5} fill={p.plate} />
            <line
              x1={X(px) - poleWpx * 0.85} y1={gradeY} x2={X(px) - poleWpx * 0.85} y2={gradeY + 22}
              stroke={p.plate} strokeWidth={2} strokeDasharray="3 2"
            />
            <line
              x1={X(px) + poleWpx * 0.85} y1={gradeY} x2={X(px) + poleWpx * 0.85} y2={gradeY + 22}
              stroke={p.plate} strokeWidth={2} strokeDasharray="3 2"
            />
          </g>
        ))}

      {/* Sign faces */}
      {faces.map((f) => {
        const bot = Math.max(0, f.topFt - f.heightFt);
        const hPx = (f.topFt - bot) * scale;
        const wPx = f.widthFt * scale;
        const boxY = Y(f.topFt);
        const fits = hPx >= 30 && wPx >= 110;
        return (
          <g key={f.id}>
            <rect x={X(-f.widthFt / 2)} y={boxY} width={wPx} height={hPx} fill={p.faceFill} stroke={p.faceStroke} strokeWidth={1.5} />
            {fits ? (
              <>
                <text x={cx} y={boxY + hPx / 2 - 7} textAnchor="middle" fill={p.faceName} fontSize={13} fontWeight={800}>
                  {f.label || 'Sign face'}
                </text>
                <text x={cx} y={boxY + hPx / 2 + 10} textAnchor="middle" fill={p.faceDims} fontSize={12} fontWeight={700}>
                  {fmt(f.widthFt)}' × {fmt(f.heightFt)}'
                </text>
              </>
            ) : (
              <text x={cx} y={boxY + hPx / 2 + 3} textAnchor="middle" fill={p.faceDims} fontSize={12} fontWeight={700}>
                {fmt(f.widthFt)}' × {fmt(f.heightFt)}'
              </text>
            )}
          </g>
        );
      })}

      {/* Grade line + label */}
      <line x1={0} y1={gradeY} x2={SKETCH_VB_W} y2={gradeY} stroke={p.grade} strokeWidth={2} />
      <text x={10} y={gradeY - 6} fill={p.gradeLabel} fontSize={10} fontWeight={800} letterSpacing="1">GRADE</text>

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
      <line x1={X(-maxHalfX)} y1={gradeY} x2={dimLX - 5} y2={gradeY} stroke={p.ext} strokeWidth={1} strokeDasharray="4 3" />
      <g>
        <line x1={dimLX} y1={gradeY} x2={dimLX} y2={footBotY} stroke={p.dim} strokeWidth={1} />
        <line x1={dimLX - 5} y1={gradeY} x2={dimLX + 5} y2={gradeY} stroke={p.dim} strokeWidth={1} />
        <line x1={dimLX - 5} y1={footBotY} x2={dimLX + 5} y2={footBotY} stroke={p.dim} strokeWidth={1} />
        <text x={dimLX - 8} y={(gradeY + footBotY) / 2} fill={p.dimLabel} fontSize={12} fontWeight={800} textAnchor="end" dominantBaseline="middle">
          {fmtFtIn(depth)} embed
        </text>
      </g>

      {/* Pole leader + label */}
      {(() => {
        const px = poleXs[poleXs.length - 1];
        const midY = Y(Math.max(lowestFaceBottom / 2, lowestFaceBottom > 2 ? lowestFaceBottom / 2 : topMax * 0.12));
        const lx = X(px) + poleWpx / 2;
        return (
          <g>
            <line x1={lx} y1={midY} x2={lx + 26} y2={midY - 14} stroke={p.dim} strokeWidth={1} />
            <text x={lx + 30} y={midY - 17} fill={p.callout} fontSize={12} fontWeight={700}>{poleLabel}</text>
          </g>
        );
      })()}

      {/* Footing label */}
      <text x={cx} y={footBotY + 18} textAnchor="middle" fill={p.callout} fontSize={12} fontWeight={700}>
        {footingLabel} · {fmtFtIn(depth)} deep
      </text>
    </svg>
  );
}
