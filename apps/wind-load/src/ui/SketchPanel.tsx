import type { DesignInput, DesignResult } from '../lib/engine';
import { fmt, fmtFtIn } from './fields';
import { SKETCH_PALETTES, SketchSvg, sketchAvailable } from './SketchSvg';
import type { Theme } from './useTheme';

// Elevation sketch view: the shared SketchSvg drawing plus a summary KPI
// strip. Inputs stay in the left column, so the drawing updates live.

interface Props {
  input: DesignInput;
  result: DesignResult;
  theme: Theme;
}

export function SketchPanel({ input, result, theme }: Props) {
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
          <SketchSvg input={input} result={result} palette={SKETCH_PALETTES[theme]} />
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
          <p className="kpi-value sketch-kpi">{fmt(Math.ceil(footing.totalVolumeYd3 * 2) / 2, 1)} yd³</p>
          <p className="kpi-foot">order volume (±)</p>
        </div>
      </div>
    </div>
  );
}
