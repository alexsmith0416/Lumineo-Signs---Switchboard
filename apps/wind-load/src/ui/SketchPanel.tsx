import type { DesignInput, DesignResult } from '../lib/engine';
import { fmt, fmtFtIn } from './fields';

// Elevation sketch of the calculated design: sign faces as boxes on the
// pole(s), footings hatched in below grade, with dimension lines for overall
// height and embedment. Drawn to scale from the live inputs/results (pole and
// footing widths get a minimum pixel size so thin members stay visible).

interface Props {
  input: DesignInput;
  result: DesignResult;
}

const VB_W = 760;
const VB_H = 620;
const PAD_L = 118;
const PAD_R = 118;
const PAD_T = 40;
const PAD_B = 56;

/** Even pole/footing positions across the widest face (centered strips). */
function layoutXs(count: number, widthFt: number): number[] {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) => -widthFt / 2 + (widthFt * (i + 0.5)) / count);
}

function VDim({
  x,
  yTop,
  yBot,
  label,
  side,
}: {
  x: number;
  yTop: number;
  yBot: number;
  label: string;
  side: 'left' | 'right';
}) {
  const mid = (yTop + yBot) / 2;
  return (
    <g className="sk-dim">
      <line x1={x} y1={yTop} x2={x} y2={yBot} />
      <line x1={x - 5} y1={yTop} x2={x + 5} y2={yTop} />
      <line x1={x - 5} y1={yBot} x2={x + 5} y2={yBot} />
      <text
        x={side === 'left' ? x - 8 : x + 8}
        y={mid}
        textAnchor={side === 'left' ? 'end' : 'start'}
        dominantBaseline="middle"
        className="sk-dim-label"
      >
        {label}
      </text>
    </g>
  );
}

export function SketchPanel({ input, result }: Props) {
  const faces = result.elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const section = result.column.section;
  const footing = result.footing;

  if (faces.length === 0 || !section || !footing || footing.depthFt <= 0) {
    return (
      <div className="results-col">
        <div className="panel empty-state">
          <p>Enter the sign face dimensions on the left — the elevation sketch draws itself from the calculated design.</p>
        </div>
      </div>
    );
  }

  const topMax = Math.max(...faces.map((f) => f.topFt));
  const widest = Math.max(...faces.map((f) => f.widthFt));
  const depth = footing.depthFt;
  const footWFt = input.footingType === 'round' ? input.caissonDiaFt : input.pierWidthFt;
  const poleWFt = section.odIn / 12;

  const poleXs = layoutXs(input.numColumns, widest);
  const footXs = layoutXs(input.numFootings, widest);

  // World extents (ft) → uniform scale into the viewBox.
  const maxHalfX = Math.max(
    widest / 2,
    ...footXs.map((x) => Math.abs(x) + footWFt / 2),
    ...poleXs.map((x) => Math.abs(x) + poleWFt / 2),
  );
  const scale = Math.min(
    (VB_H - PAD_T - PAD_B) / (topMax + depth),
    (VB_W - PAD_L - PAD_R) / (2 * maxHalfX),
  );

  const cx = VB_W / 2;
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

  return (
    <div className="results-col">
      <section className="panel">
        <h2 className="panel-caption">Elevation Sketch</h2>
        <div className="panel-body sketch-body">
          <svg
            className="sketch-svg"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            role="img"
            aria-label="Elevation sketch of the sign structure"
          >
            <defs>
              <pattern id="sk-earth" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="9" className="sk-earth-hatch" />
              </pattern>
              <pattern id="sk-conc" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                <line x1="0" y1="0" x2="0" y2="10" className="sk-conc-hatch" />
              </pattern>
            </defs>

            {/* Earth below grade */}
            <rect x={0} y={gradeY} width={VB_W} height={VB_H - gradeY} className="sk-earth" />
            <rect x={0} y={gradeY} width={VB_W} height={VB_H - gradeY} fill="url(#sk-earth)" />

            {/* Footings */}
            {footXs.map((fx, i) => (
              <g key={`f-${i}`}>
                <rect
                  x={X(fx) - footWpx / 2}
                  y={gradeY}
                  width={footWpx}
                  height={footBotY - gradeY}
                  className="sk-footing"
                />
                <rect
                  x={X(fx) - footWpx / 2}
                  y={gradeY}
                  width={footWpx}
                  height={footBotY - gradeY}
                  fill="url(#sk-conc)"
                />
              </g>
            ))}

            {/* Poles (embedded to 3" above footing bottom, or on base plates) */}
            {poleXs.map((px, i) => {
              const topY = Y(topMax);
              const botY = input.basePlate.enabled ? gradeY : footBotY - Math.min(6, 0.25 * scale);
              return <rect key={`p-${i}`} x={X(px) - poleWpx / 2} y={topY} width={poleWpx} height={botY - topY} className="sk-pole" />;
            })}

            {/* Base plates + anchor bolts */}
            {input.basePlate.enabled &&
              poleXs.map((px, i) => (
                <g key={`bp-${i}`}>
                  <rect
                    x={X(px) - poleWpx * 1.15}
                    y={gradeY - 4}
                    width={poleWpx * 2.3}
                    height={5}
                    className="sk-plate"
                  />
                  <line x1={X(px) - poleWpx * 0.85} y1={gradeY} x2={X(px) - poleWpx * 0.85} y2={gradeY + 22} className="sk-bolt" />
                  <line x1={X(px) + poleWpx * 0.85} y1={gradeY} x2={X(px) + poleWpx * 0.85} y2={gradeY + 22} className="sk-bolt" />
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
                  <rect x={X(-f.widthFt / 2)} y={boxY} width={wPx} height={hPx} className="sk-face" />
                  {fits ? (
                    <>
                      <text x={cx} y={boxY + hPx / 2 - 7} textAnchor="middle" className="sk-face-name">
                        {f.label || 'Sign face'}
                      </text>
                      <text x={cx} y={boxY + hPx / 2 + 10} textAnchor="middle" className="sk-face-dims">
                        {fmt(f.widthFt)}' × {fmt(f.heightFt)}'
                      </text>
                    </>
                  ) : (
                    <text x={cx} y={boxY + hPx / 2 + 3} textAnchor="middle" className="sk-face-dims">
                      {fmt(f.widthFt)}' × {fmt(f.heightFt)}'
                    </text>
                  )}
                </g>
              );
            })}

            {/* Grade line + label */}
            <line x1={0} y1={gradeY} x2={VB_W} y2={gradeY} className="sk-grade" />
            <text x={10} y={gradeY - 6} className="sk-grade-label">GRADE</text>

            {/* Extension + dimension lines */}
            <line x1={X(widest / 2)} y1={Y(topMax)} x2={dimX + 5} y2={Y(topMax)} className="sk-ext" />
            <line x1={X(maxHalfX)} y1={gradeY} x2={dimX + 5} y2={gradeY} className="sk-ext" />
            <VDim x={dimX} yTop={Y(topMax)} yBot={gradeY} label={`${fmtFtIn(topMax)} OAH`} side="right" />

            <line x1={X(-maxHalfX)} y1={footBotY} x2={dimLX - 5} y2={footBotY} className="sk-ext" />
            <line x1={X(-maxHalfX)} y1={gradeY} x2={dimLX - 5} y2={gradeY} className="sk-ext" />
            <VDim x={dimLX} yTop={gradeY} yBot={footBotY} label={`${fmtFtIn(depth)} embed`} side="left" />

            {/* Pole leader + label */}
            {(() => {
              const px = poleXs[poleXs.length - 1];
              const midY = Y(Math.max(lowestFaceBottom / 2, lowestFaceBottom > 2 ? lowestFaceBottom / 2 : topMax * 0.12));
              const lx = X(px) + poleWpx / 2;
              return (
                <g>
                  <line x1={lx} y1={midY} x2={lx + 26} y2={midY - 14} className="sk-leader" />
                  <text x={lx + 30} y={midY - 17} className="sk-callout">{poleLabel}</text>
                </g>
              );
            })()}

            {/* Footing label */}
            <text x={cx} y={footBotY + 18} textAnchor="middle" className="sk-callout">
              {footingLabel} · {fmtFtIn(depth)} deep
            </text>
          </svg>

          <p className="hint sketch-note">
            Proportions are to scale from the calculated design; very thin poles
            and footings are widened slightly so they stay visible. Elevation
            view — pier length runs perpendicular to the sign face.
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
          <p className="kpi-value sketch-kpi">{fmtFtIn(depth)} deep</p>
          <p className="kpi-foot">{footingLabel}</p>
        </div>
        <div className="kpi">
          <p className="kpi-caption">OVERALL HEIGHT</p>
          <p className="kpi-value sketch-kpi">{fmtFtIn(topMax)}</p>
          <p className="kpi-foot">{fmt(result.totalAreaSqFt, 1)} sq ft of sign</p>
        </div>
        <div className="kpi">
          <p className="kpi-caption">CONCRETE</p>
          <p className="kpi-value sketch-kpi">{fmt(Math.ceil(footing.totalVolumeYd3 * 2) / 2, 1)} yd³</p>
          <p className="kpi-foot">order volume (±)</p>
        </div>
      </div>
    </div>
  );
}
