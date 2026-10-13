import type { DesignInput, DesignResult } from '../lib/engine';
import { sectionDepthIn, sectionIsRound } from '../data/tables';
import { fmt, fmtFrac } from './fields';
import type { SketchPalette } from './SketchSvg';

// Plan (top) view of one base plate and its J-bolt pattern. Same deal as
// SketchSvg: concrete hex colours in through a palette prop, no CSS, so the
// one component renders on screen and serializes for the PDF export.
//
// Orientation matches the elevation — the sign face runs left to right, so
// the two bolt lines straddle it front and back, and the bolts within a line
// spread along the face.

export const PLAN_VB_W = 520;
export const PLAN_VB_H = 430;
const PAD_X = 92;
const PAD_T = 74;
const PAD_B = 98;
const FONT = "'Open Sans', Helvetica, Arial, sans-serif";

interface Props {
  input: DesignInput;
  result: DesignResult;
  palette: SketchPalette;
  /** Solid background fill (for export); omit for transparent on-screen use. */
  background?: string;
}

/** True when there is a plate with a resolved section to draw. */
export function planAvailable(result: DesignResult): boolean {
  return result.basePlate !== null && result.column.section !== null;
}

export function BasePlatePlanSvg({ input, result, palette: p, background }: Props) {
  const bp = result.basePlate!;
  const section = result.column.section!;
  const round = sectionIsRound(section, input.columnType);

  const n = input.basePlate.boltsPerLine;
  const dia = bp.boltDiaIn;
  // Bolt lines straddle the face front and back; the bolts in a line spread
  // along it. Both are centre-to-centre.
  const lineGap = bp.boltLineSpacingIn;
  const patternB = bp.boltPatternBIn;

  const spanX = Math.max(bp.plateBIn, patternB + 2 * dia);
  const spanY = Math.max(bp.plateNIn, lineGap + 2 * dia);
  const scale = Math.min(
    (PLAN_VB_W - 2 * PAD_X) / spanX,
    (PLAN_VB_H - PAD_T - PAD_B) / spanY,
  );

  const cx = PLAN_VB_W / 2;
  const cy = PAD_T + ((PLAN_VB_H - PAD_T - PAD_B) / 2);
  const X = (inches: number) => cx + inches * scale;
  const Y = (inches: number) => cy + inches * scale;

  const plateW = bp.plateBIn * scale;
  const plateH = bp.plateNIn * scale;
  const colW = section.odIn * scale;
  const colH = sectionDepthIn(section) * scale;
  const boltR = Math.max((dia / 2) * scale, 2.5);

  const boltXs = Array.from({ length: n }, (_, i) =>
    n === 1 ? 0 : -patternB / 2 + (patternB * i) / (n - 1),
  );

  // Everything the drawing reaches, so the face line and the side dimension
  // clear the bolts when the spacing throws them off the plate.
  const halfSpanX = Math.max(plateW / 2, Math.abs(X(patternB / 2) - cx) + boltR);
  const topY = Math.min(Y(-lineGap / 2) - boltR, cy - plateH / 2);
  const botY = Math.max(Y(lineGap / 2) + boltR, cy + plateH / 2);

  const tick = (key: string, x: number, y: number, vertical: boolean) =>
    vertical ? (
      <line key={key} x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={p.dim} strokeWidth={1} />
    ) : (
      <line key={key} x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={p.dim} strokeWidth={1} />
    );

  /** Dimension run with ticks and a label clear of the line. */
  const dimH = (key: string, x1: number, x2: number, y: number, label: string) => (
    <g key={key}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={p.dim} strokeWidth={1} />
      {tick(`${key}-a`, x1, y, false)}
      {tick(`${key}-b`, x2, y, false)}
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fill={p.dimLabel} fontSize={10.5} fontWeight={800}>
        {label}
      </text>
    </g>
  );
  const dimV = (key: string, y1: number, y2: number, x: number, label: string) => (
    <g key={key}>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={p.dim} strokeWidth={1} />
      {tick(`${key}-a`, x, y1, true)}
      {tick(`${key}-b`, x, y2, true)}
      <text
        x={x - 7}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        fill={p.dimLabel}
        fontSize={10.5}
        fontWeight={800}
        transform={`rotate(-90 ${x - 7} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </g>
  );

  return (
    <svg
      className="plan-svg"
      viewBox={`0 0 ${PLAN_VB_W} ${PLAN_VB_H}`}
      width={PLAN_VB_W}
      height={PLAN_VB_H}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Plan view of the base plate and anchor bolt layout"
      style={{ fontFamily: FONT }}
    >
      {background && <rect x={0} y={0} width={PLAN_VB_W} height={PLAN_VB_H} fill={background} />}

      <text x={cx} y={24} textAnchor="middle" fill={p.gradeLabel} fontSize={10} fontWeight={800} letterSpacing="1">
        PLAN — ONE BASE PLATE
      </text>

      {/* Plate */}
      <rect
        x={cx - plateW / 2}
        y={cy - plateH / 2}
        width={plateW}
        height={plateH}
        fill={p.footingFill}
        stroke={p.footingStroke}
        strokeWidth={1.5}
      />
      {/* Column footprint, welded to the plate */}
      {round ? (
        <circle cx={cx} cy={cy} r={colW / 2} fill="none" stroke={p.pole} strokeWidth={2} />
      ) : (
        <rect
          x={cx - colW / 2}
          y={cy - colH / 2}
          width={colW}
          height={colH}
          fill="none"
          stroke={p.pole}
          strokeWidth={2}
        />
      )}

      {/* Sign face runs across the view; the bolt lines straddle it */}
      <line
        x1={cx - halfSpanX - 22}
        y1={cy}
        x2={cx + halfSpanX + 22}
        y2={cy}
        stroke={p.leader}
        strokeWidth={1.2}
        strokeDasharray="7 4"
        strokeOpacity={0.8}
      />
      <text
        x={cx + halfSpanX + 26}
        y={cy + 3.5}
        fill={p.leader}
        fontSize={9.5}
        fontWeight={800}
        letterSpacing="0.6"
      >
        SIGN FACE
      </text>

      {/* J-bolts */}
      {[-1, 1].map((sideY) =>
        boltXs.map((bx, i) => {
          const x = X(bx);
          const y = Y((sideY * lineGap) / 2);
          return (
            <g key={`b-${sideY}-${i}`}>
              <circle cx={x} cy={y} r={boltR} fill={p.faceFill} stroke={p.faceStroke} strokeWidth={1.6} />
              <line x1={x - boltR - 3} y1={y} x2={x + boltR + 3} y2={y} stroke={p.faceStroke} strokeWidth={0.8} />
              <line x1={x} y1={y - boltR - 3} x2={x} y2={y + boltR + 3} stroke={p.faceStroke} strokeWidth={0.8} />
            </g>
          );
        }),
      )}

      {/* Dimensions: plate across the bottom, bolt lines up the left, the
          in-line bolt spacing across the top. */}
      {dimH(
        'plate-b',
        cx - plateW / 2,
        cx + plateW / 2,
        botY + 30,
        `${fmt(bp.plateBIn, 1)}" sq × ${fmt(Math.ceil(bp.plateThicknessIn * 8) / 8, 3)}" plate`,
      )}
      {dimV('lines', Y(-lineGap / 2), Y(lineGap / 2), cx - halfSpanX - 26, `${fmt(lineGap, 1)}" bolt lines`)}
      {n > 1 &&
        dimH('in-line', X(boltXs[0]), X(boltXs[n - 1]), topY - 24, `${fmt(bp.boltSpacingIn, 1)}" between bolts`)}

      {/* Bolt call-out */}
      <text x={cx} y={PLAN_VB_H - 40} textAnchor="middle" fill={p.callout} fontSize={12} fontWeight={800}>
        {2 * n} × Ø {fmtFrac(dia)} J-BOLT × {fmt(bp.boltLengthIn, 0)}" · {fmt(bp.boltHookIn, 2)}" HOOK
      </text>
      <text x={cx} y={PLAN_VB_H - 24} textAnchor="middle" fill={p.gradeLabel} fontSize={10} fontWeight={700}>
        {fmt(bp.embedLengthIn, 1)}" embedded · {fmt(bp.boltProjectionIn, 2)}" above the concrete
      </text>

      {!bp.boltsFitPlate && (
        <text x={cx} y={PLAN_VB_H - 60} textAnchor="middle" fill={p.faceStroke} fontSize={10} fontWeight={800}>
          BOLTS FALL OUTSIDE THE PLATE — SET THE SPACING BY HAND
        </text>
      )}
    </svg>
  );
}
