import type { DesignInput, DesignResult } from '../lib/engine';
import { MAX_HAUL_FT, MAX_ORDER_FT } from '../lib/engine';
import { SHAPE_LABELS, isAluminum, isRound } from '../data/tables';
import { fmt, fmtFtIn, fmtInt } from './fields';

interface Props {
  input: DesignInput;
  result: DesignResult;
}

function Chip({ ok, okText = 'OK', badText = 'NG' }: { ok: boolean; okText?: string; badText?: string }) {
  return <span className={`chip ${ok ? 'chip-green' : 'chip-red'}`}>{ok ? okText : badText}</span>;
}

function Row({ label, value, chip }: { label: string; value: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className="result-value">{value}</span>
      {chip}
    </div>
  );
}

function UtilizationBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const tone = ratio <= 0.85 ? 'green' : ratio <= 1 ? 'amber' : 'red';
  return (
    <div className="util">
      <div className="util-track">
        <div className={`util-fill util-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`util-pct util-pct-${tone}`}>{fmt(ratio * 100, 0)}%</span>
    </div>
  );
}

export function ResultsPanel({ input, result }: Props) {
  const r = result;
  const hasDesign = r.momentAtGradeLbFt > 0 && r.totalAreaSqFt > 0;
  const maxPressure = r.elements.reduce((m, e) => Math.max(m, e.pressurePsf), 0);

  return (
    <div className="results-col">
      <div className="disclaimer" role="note">
        <strong>Preliminary sizing only.</strong> Calculations follow the shop's
        UBC 1994 / AISC 9th ed. workbook. Final structural design and permit
        drawings must be prepared or verified by a licensed engineer.
      </div>

      {r.errors.length > 0 && (
        <div className="error-banner" role="alert">
          {r.errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      {r.warnings.length > 0 && (
        <div className="warn-banner" role="status">
          {r.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {!hasDesign ? (
        <div className="panel empty-state">
          <p>Enter the sign face dimensions on the left to size the poles and footings.</p>
        </div>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <p className="kpi-caption">DESIGN WIND PRESSURE</p>
              <p className="kpi-value">{fmt(maxPressure, 1)} <span className="kpi-unit">psf</span></p>
              <p className="kpi-foot">qs {fmt(r.qsPsf, 1)} psf · exposure {input.exposure} · Cq {input.cq}</p>
            </div>
            <div className="kpi">
              <p className="kpi-caption">MOMENT AT GRADE</p>
              <p className="kpi-value">{fmtInt(r.momentAtGradeLbFt)} <span className="kpi-unit">lb-ft</span></p>
              <p className="kpi-foot">all poles combined</p>
            </div>
            <div className="kpi">
              <p className="kpi-caption">SHEAR AT GRADE</p>
              <p className="kpi-value">{fmtInt(r.shearAtGradeLb)} <span className="kpi-unit">lb</span></p>
              <p className="kpi-foot">total wind force</p>
            </div>
            <div className="kpi">
              <p className="kpi-caption">SIGN AREA</p>
              <p className="kpi-value">{fmt(r.totalAreaSqFt, 1)} <span className="kpi-unit">sq ft</span></p>
              <p className="kpi-foot">{r.elements.length} element{r.elements.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          <section className="panel">
            <h2 className="panel-caption">
              {r.column.mode === 'manual' ? 'Pole (your size)' : 'Recommended Pole'}
            </h2>
            <div className="panel-body">
              {r.column.section ? (
                <>
                  <div className="hero-line">
                    <span className="hero-value">
                      {input.numColumns} × {SHAPE_LABELS[input.columnType].short} {r.column.section.name}
                    </span>
                    <Chip ok={r.column.ok} okText="OK" badText="OVERSTRESSED" />
                    {r.column.mode === 'manual' && r.column.autoSection && (
                      <span className="chip chip-neutral">
                        {r.column.autoSection.name === r.column.section.name
                          ? 'MATCHES RECOMMENDATION'
                          : r.column.belowRecommended
                            ? `SMALLER THAN ${r.column.autoSection.name}`
                            : `LARGER THAN ${r.column.autoSection.name}`}
                      </span>
                    )}
                  </div>
                  <Row
                    label="Section modulus"
                    value={`${fmt(r.column.requiredSm)} in³ required · ${fmt(r.column.section.sm)} in³ provided (per pole)`}
                  />
                  <Row
                    label="Bending stress"
                    value={
                      r.column.FbKsi !== null
                        ? `fb ${fmt(r.column.fbKsi ?? 0)} ksi vs Fb ${fmt(r.column.FbKsi)} ksi (incl. ×${input.stressIncrease} wind increase)`
                        : `fb ${fmt(r.column.fbKsi ?? 0)} ksi — slender section`
                    }
                  />
                  <UtilizationBar ratio={r.column.utilization} />
                  <Row
                    label="Size"
                    value={`${fmt(r.column.section.odIn, 3)}" ${isRound(input.columnType) ? 'OD' : 'square'} × ${fmt(r.column.section.wallIn, 4)}" wall · ${fmt(r.column.section.areaSqIn)} in² ${isAluminum(input.columnType) ? 'aluminum' : 'steel'}`}
                  />
                  {r.column.section.sleeveIn !== null && (
                    <Row label="Splice sleeve depth" value={`${r.column.section.sleeveIn}" (if a stepped column is used)`} />
                  )}
                  {r.poleLength && (
                    <Row
                      label="Pole length"
                      value={`${fmtFtIn(r.poleLength.totalFt)} total (${fmtFtIn(r.poleLength.embedFt)} embedded + ${fmtFtIn(r.poleLength.totalFt - r.poleLength.embedFt)} above grade) · order max ${MAX_ORDER_FT}', haul max ${MAX_HAUL_FT}'`}
                      chip={
                        r.transition
                          ? <span className="chip chip-green">SPLICED</span>
                          : <Chip
                              ok={r.poleLength.haulOk}
                              okText="HAULABLE"
                              badText={r.poleLength.orderOk ? 'OVER 30\' HAUL' : 'OVER 40\' ORDER'}
                            />
                      }
                    />
                  )}
                  <p className="hint">{r.column.compactness}</p>
                </>
              ) : (
                <p className="muted">No standard size carries this load — add poles or reduce the sign.</p>
              )}
            </div>
          </section>

          {r.transition && (
            <section className="panel">
              <h2 className="panel-caption">Transition Pipe Splice</h2>
              <div className="panel-body">
                <div className="hero-line">
                  <span className="hero-value">
                    {r.transition.section
                      ? `Upper: ${input.numColumns} × ${SHAPE_LABELS[input.columnType].short} ${r.transition.section.name}`
                      : 'No fitting upper size'}
                  </span>
                  <Chip
                    ok={r.transition.fitsInside && r.transition.ok && r.transition.orderOk && r.transition.haulOk}
                    okText="OK"
                    badText="CHECK"
                  />
                </div>
                <Row
                  label="Splice height"
                  value={`${fmtFtIn(r.transition.spliceFt)} above grade · upper pipe extends ${fmt(r.transition.overlapFt)}' inside the base pipe`}
                />
                <Row
                  label="Piece lengths"
                  value={`base ${fmtFtIn(r.transition.basePipeFt)} · upper ${fmtFtIn(r.transition.upperPipeFt)} (incl. ${fmt(r.transition.overlapFt)}' overlap) · order max ${MAX_ORDER_FT}', haul max ${MAX_HAUL_FT}'`}
                  chip={<Chip ok={r.transition.orderOk && r.transition.haulOk} okText="HAULABLE" badText="TOO LONG" />}
                />
                <Row
                  label="Moment at splice"
                  value={`${fmtInt(r.transition.momentAtSpliceLbFt)} lb-ft → ${fmt(r.transition.requiredSm)} in³ required per pole`}
                />
                {r.transition.section && (
                  <Row
                    label="Upper pipe stress"
                    value={
                      r.transition.FbKsi !== null
                        ? `fb ${fmt(r.transition.fbKsi ?? 0)} ksi vs Fb ${fmt(r.transition.FbKsi)} ksi · ${fmt(r.transition.section.odIn, 3)}" OD fits ${fmt(r.transition.baseIdIn, 3)}" base ID`
                        : 'slender section — verify with an engineer'
                    }
                    chip={<Chip ok={r.transition.ok} />}
                  />
                )}
                <Row
                  label="Ring plates"
                  value={`1/2" steel · outer Ø ${fmt(r.transition.ringOuterOdIn, 2)}" welded to top of base pipe · inner Ø ${fmt(r.transition.ringInnerOdIn, 2)}" snug in base pipe ID${r.transition.ringBoreIn ? ` · bored Ø ${fmt(r.transition.ringBoreIn, 2)}" for the upper pipe` : ''}`}
                />
              </div>
            </section>
          )}

          {r.footing && (
            <section className="panel">
              <h2 className="panel-caption">
                {input.footingType === 'round' ? 'Round Caisson Footing' : 'Rectangular Pier Footing'}
              </h2>
              <div className="panel-body">
                <div className="hero-line">
                  <span className="hero-value">
                    {input.footingType === 'round'
                      ? `${input.numFootings} × Ø ${fmt(r.footing.diameterFt)}' × ${fmtFtIn(r.footing.depthFt)} deep`
                      : `${input.numFootings} × ${fmt(r.footing.planWidthFt)}' × ${fmt(r.footing.planLengthFt)}' × ${fmtFtIn(r.footing.depthFt)} deep`}
                  </span>
                  <Chip ok={r.footing.bearingOk} okText="BEARING OK" badText="BEARING NG" />
                </div>
                <Row label="Required embedment" value={`${fmt(r.footing.depthFt)} ft (UBC 1806.7, nonconstrained)`} />
                <Row
                  label="Design load"
                  value={`M ${fmtInt(r.footing.momentPerFootingLbFt)} lb-ft / footing · P = M/h = ${fmtInt(r.footing.equivalentLoadLb)} lb at h ${fmt(r.footing.centroidFt, 1)} ft`}
                />
                <Row
                  label="Lateral soil pressure"
                  value={`S1 ${fmtInt(r.footing.s1Psf)} psf at D/3 (2 × ${fmtInt(input.lateralSoilPsf)} psf/ft, isolated pole)`}
                />
                <Row
                  label="Soil bearing"
                  value={`q max ${fmtInt(r.footing.qMaxPsf)} psf vs allowed ${fmtInt(r.footing.qAllowedPsf)} psf`}
                  chip={<Chip ok={r.footing.bearingOk} />}
                />
                {r.column.section && (
                  <Row
                    label="Concrete cover"
                    value={`needs ≥ ${fmt(r.footing.minWidthForCoverFt)}' across for 3" cover around the ${fmt(r.column.section.odIn, 3)}" pole`}
                    chip={<Chip ok={r.footing.coverOk} okText={'3" COVER OK'} badText="TOO TIGHT" />}
                  />
                )}
                <Row
                  label="Concrete"
                  value={`${fmt(r.footing.volumePerFootingYd3, 2)} yd³ / footing · ${fmt(r.footing.totalVolumeYd3, 2)} yd³ all footings (±)`}
                />
                {r.mowPad && (
                  <>
                    <Row
                      label="Mow pad"
                      value={`${fmt(input.mowPad.lengthFt)}' along face × ${fmt(input.mowPad.widthFt)}' across × ${fmt(input.mowPad.heightIn, 2)}" tall on soil · ${fmt(r.mowPad.volumeYd3, 2)} yd³ · needs ≥ ${fmt(r.mowPad.requiredLengthFt)}' × ${fmt(r.mowPad.requiredWidthFt)}' (footing + 6")`}
                      chip={<Chip ok={r.mowPad.sizeOk} okText="CLEARS FOOTING" badText="TOO SMALL" />}
                    />
                    <Row
                      label="Total concrete"
                      value={`order ${fmt(Math.ceil((r.footing.totalVolumeYd3 + r.mowPad.volumeYd3) * 2) / 2, 1)} yd³ (footings ${fmt(r.footing.totalVolumeYd3, 2)} + pad ${fmt(r.mowPad.volumeYd3, 2)}) (±)`}
                    />
                  </>
                )}
                {!r.mowPad && (
                  <Row
                    label="Total concrete"
                    value={`order ${fmt(Math.ceil(r.footing.totalVolumeYd3 * 2) / 2, 1)} yd³ (±)`}
                  />
                )}
              </div>
            </section>
          )}

          {r.basePlate && (
            <section className="panel">
              <h2 className="panel-caption">Base Plate &amp; Anchor Bolts</h2>
              <div className="panel-body">
                <div className="hero-line">
                  <span className="hero-value">
                    PL {fmt(r.basePlate.plateNIn, 1)}" × {fmt(r.basePlate.plateBIn, 1)}" ×{' '}
                    {fmt(Math.ceil(r.basePlate.plateThicknessIn * 8) / 8, 3)}"
                  </span>
                  <Chip
                    ok={r.basePlate.coneOk && r.basePlate.tensionOk && r.basePlate.weldOk}
                    okText="OK"
                    badText="CHECK"
                  />
                </div>
                <Row
                  label="Plate thickness"
                  value={`${fmt(r.basePlate.plateThicknessIn, 3)}" calculated (without gussets), per plate M ${fmtInt(r.basePlate.momentPerPlateLbFt)} lb-ft`}
                />
                <Row
                  label="Anchor bolts"
                  value={`${2 * input.basePlate.boltsPerLine} per plate · Ø ${fmt(r.basePlate.boltDiaIn, 3)}" A36 rod (min ${fmt(r.basePlate.minBoltDiaIn, 3)}") · embed ${fmt(r.basePlate.embedLengthIn, 1)}"`}
                />
                <Row
                  label="Bolt spacing"
                  value={`lines at ${fmt(r.basePlate.boltLineSpacingIn, 1)}" · in-line ${fmt(r.basePlate.boltSpacingIn, 1)}" (min ${fmt(r.basePlate.minBoltSpacingIn, 1)}") · edge ≥ ${fmt(r.basePlate.minEdgeSpacingIn, 1)}"`}
                />
                <Row
                  label="Concrete cone"
                  value={`capacity ${fmtInt(r.basePlate.coneCapacityLb)} lb vs ${fmtInt(r.basePlate.tensionPerAnchorLb)} lb / anchor`}
                  chip={<Chip ok={r.basePlate.coneOk} />}
                />
                <Row
                  label="Bolt tension + shear"
                  value={`ft ${fmtInt(r.basePlate.actualTensionPsi)} psi vs allowed ${fmtInt(r.basePlate.allowedTensionPsi)} psi (fv ${fmtInt(r.basePlate.shearStressPsi)} psi)`}
                  chip={<Chip ok={r.basePlate.tensionOk} />}
                />
                <Row
                  label="Column weld"
                  value={`${fmt(input.basePlate.weldLegIn, 4)}" fillet · fw ${fmtInt(r.basePlate.weldStressPsi)} psi vs 21,000 psi (E70XX)`}
                  chip={<Chip ok={r.basePlate.weldOk} okText="OK" badText="USE GUSSETS" />}
                />
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="panel-caption">Wind Forces by Element</h2>
            <div className="panel-body table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Element</th>
                    <th className="num">W × H (ft)</th>
                    <th className="num">Area (sq ft)</th>
                    <th className="num">Centroid (ft)</th>
                    <th className="num">Pressure (psf)</th>
                    <th className="num">Force (lb)</th>
                    <th className="num">Moment (lb-ft)</th>
                  </tr>
                </thead>
                <tbody>
                  {r.elements.map((e) => (
                    <tr key={e.id}>
                      <td>{e.label || '—'}</td>
                      <td className="num">{fmt(e.widthFt)} × {fmt(e.heightFt)}</td>
                      <td className="num">{fmt(e.areaSqFt, 1)}</td>
                      <td className="num">{fmt(e.centroidFt, 1)}</td>
                      <td className="num">{fmt(e.pressurePsf, 1)}</td>
                      <td className="num">{fmtInt(e.forceLb)}</td>
                      <td className="num">{fmtInt(e.momentLbFt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td />
                    <td className="num">{fmt(r.totalAreaSqFt, 1)}</td>
                    <td />
                    <td />
                    <td className="num">{fmtInt(r.totalForceLb)}</td>
                    <td className="num">{fmtInt(r.momentAtGradeLbFt)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="panel-foot">
              Element pressures round the centroid up to the next UBC height
              bracket (conservative). Seismic comparison: Fp ={' '}
              {fmt(r.seismic.fpPsf, 1)} psf (zone {input.seismicZone}) —{' '}
              {r.seismic.windGoverns ? 'wind governs.' : 'seismic may govern; review required.'}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
