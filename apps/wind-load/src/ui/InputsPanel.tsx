import type { DesignInput, SignElementInput } from '../lib/engine';
import { MAX_HAUL_FT, MAX_ORDER_FT } from '../lib/engine';
import { EXPOSURE_DESCRIPTIONS, sectionsFor, type Exposure } from '../data/tables';
import { FtInField, NumField, fmt } from './fields';
import { IconPlus, IconTrash } from './icons';

interface Props {
  input: DesignInput;
  onChange: (next: DesignInput) => void;
  /** The size auto-sizing recommends, so manual mode can label it. */
  recommendedSizeName?: string | null;
}

let elementSeq = 0;
export function newElement(): SignElementInput {
  elementSeq += 1;
  return {
    id: `el-${Date.now().toString(36)}-${elementSeq}`,
    label: `Sign face ${elementSeq}`,
    widthFt: 0,
    heightFt: 0,
    topFt: 0,
  };
}

export function InputsPanel({ input, onChange, recommendedSizeName }: Props) {
  const set = (patch: Partial<DesignInput>) => onChange({ ...input, ...patch });
  const setBp = (patch: Partial<DesignInput['basePlate']>) =>
    onChange({ ...input, basePlate: { ...input.basePlate, ...patch } });
  const setMp = (patch: Partial<DesignInput['mowPad']>) =>
    onChange({ ...input, mowPad: { ...input.mowPad, ...patch } });
  const setTr = (patch: Partial<DesignInput['transition']>) =>
    onChange({ ...input, transition: { ...input.transition, ...patch } });

  const setElement = (id: string, patch: Partial<SignElementInput>) =>
    set({ elements: input.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const removeElement = (id: string) =>
    set({ elements: input.elements.filter((e) => e.id !== id) });

  return (
    <div className="inputs-col">
      <section className="panel">
        <h2 className="panel-caption">Project</h2>
        <div className="panel-body form-grid">
          <label className="span-2">
            <span>Project name</span>
            <input
              value={input.projectName}
              onChange={(e) => set({ projectName: e.target.value })}
              placeholder="e.g. Miller Chevrolet pylon"
            />
          </label>
          <label className="span-2">
            <span>Description</span>
            <input
              value={input.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. D/F illuminated cabinet on two poles"
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-caption">Wind &amp; Site Criteria</h2>
        <div className="panel-body form-grid">
          <NumField
            label="Basic wind speed"
            suffix="mph"
            value={input.windSpeedMph}
            min={0}
            onChange={(v) => set({ windSpeedMph: v })}
          />
          <label>
            <span>Seismic zone</span>
            <select
              value={input.seismicZone}
              onChange={(e) => set({ seismicZone: Number(e.target.value) as 1 | 2 | 3 | 4 })}
            >
              <option value={1}>Zone 1</option>
              <option value={2}>Zone 2</option>
              <option value={3}>Zone 3</option>
              <option value={4}>Zone 4</option>
            </select>
          </label>
          <label className="span-2">
            <span>Exposure</span>
            <select
              value={input.exposure}
              onChange={(e) => set({ exposure: e.target.value as Exposure })}
            >
              {(['B', 'C', 'D'] as const).map((x) => (
                <option key={x} value={x}>
                  {x} — {EXPOSURE_DESCRIPTIONS[x]}
                </option>
              ))}
            </select>
          </label>
          <p className="hint span-2">
            Cq = {input.cq} (signs, flagpoles &amp; lightpoles, UBC table 16-H) ·
            wind stress increase ×{input.stressIncrease}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-caption">Sign Faces</h2>
        <div className="panel-body">
          {input.elements.map((el) => {
            const centroid = el.topFt - el.heightFt / 2;
            return (
              <div key={el.id} className="element-row">
                <div className="element-head">
                  <input
                    className="element-label"
                    value={el.label}
                    onChange={(e) => setElement(el.id, { label: e.target.value })}
                    placeholder="Label"
                    aria-label="Element label"
                  />
                  <button
                    className="icon-btn"
                    onClick={() => removeElement(el.id)}
                    disabled={input.elements.length <= 1}
                    title="Remove element"
                    aria-label={`Remove ${el.label}`}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
                <div className="form-grid">
                  <FtInField
                    label="Width"
                    value={el.widthFt}
                    onChange={(v) => setElement(el.id, { widthFt: v })}
                  />
                  <FtInField
                    label="Height"
                    value={el.heightFt}
                    onChange={(v) => setElement(el.id, { heightFt: v })}
                  />
                  <FtInField
                    label="Top above grade"
                    value={el.topFt}
                    onChange={(v) => setElement(el.id, { topFt: v })}
                  />
                </div>
                <p className="hint">
                  {fmt(el.widthFt * el.heightFt)} sq ft · centroid {fmt(centroid)} ft above grade
                </p>
              </div>
            );
          })}
          <button
            className="btn-soft add-element"
            onClick={() => set({ elements: [...input.elements, newElement()] })}
            disabled={input.elements.length >= 8}
          >
            <IconPlus size={15} />
            <span>Add sign face</span>
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-caption">Poles</h2>
        <div className="panel-body form-grid">
          <NumField
            label="Number of poles"
            value={input.numColumns}
            min={1}
            step={1}
            onChange={(v) => set({ numColumns: Math.max(1, Math.round(v)) })}
          />
          <label>
            <span>Pole type</span>
            <div className="seg full" role="tablist" aria-label="Pole type">
              <button
                role="tab"
                aria-selected={input.columnType === 'P'}
                className={`seg-btn${input.columnType === 'P' ? ' active' : ''}`}
                onClick={() => set({ columnType: 'P' })}
              >
                Round pipe
              </button>
              <button
                role="tab"
                aria-selected={input.columnType === 'TS'}
                className={`seg-btn${input.columnType === 'TS' ? ' active' : ''}`}
                onClick={() => set({ columnType: 'TS' })}
              >
                Square tube
              </button>
            </div>
          </label>
          <label className="span-2">
            <span>Pole size</span>
            <div className="seg full" role="tablist" aria-label="Pole sizing">
              <button
                role="tab"
                aria-selected={input.columnSizing === 'auto'}
                className={`seg-btn${input.columnSizing === 'auto' ? ' active' : ''}`}
                onClick={() => set({ columnSizing: 'auto' })}
              >
                Recommend for me
              </button>
              <button
                role="tab"
                aria-selected={input.columnSizing === 'manual'}
                className={`seg-btn${input.columnSizing === 'manual' ? ' active' : ''}`}
                onClick={() =>
                  set({
                    columnSizing: 'manual',
                    // Seed the picker with the current recommendation.
                    columnSizeName: input.columnSizeName ?? recommendedSizeName ?? null,
                  })
                }
              >
                Choose a size
              </button>
            </div>
          </label>

          {input.columnSizing === 'manual' && (
            <label className="span-2">
              <span>{input.columnType === 'P' ? 'Pipe size' : 'Tube size'}</span>
              <select
                value={input.columnSizeName ?? ''}
                onChange={(e) => set({ columnSizeName: e.target.value || null })}
              >
                <option value="">— select a size —</option>
                {sectionsFor(input.columnType).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} · S {fmt(s.sm)} in³ · {fmt(s.odIn, 3)}" {input.columnType === 'P' ? 'OD' : 'sq'} × {fmt(s.wallIn, 4)}" wall
                    {recommendedSizeName === s.name ? '  (recommended)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="hint span-2">
            Pipe: ASTM A53 Gr. B (Fy 35 ksi) · Tube: ASTM A500 Gr. B (Fy 46 ksi).
            {input.columnSizing === 'manual'
              ? ' Footing cover, concrete volume, base plate and transition sizing all follow the size you pick.'
              : ' Size is chosen from the wind moment at grade.'}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-caption">Footing</h2>
        <div className="panel-body form-grid">
          <label className="span-2">
            <span>Footing type</span>
            <div className="seg full" role="tablist" aria-label="Footing type">
              <button
                role="tab"
                aria-selected={input.footingType === 'round'}
                className={`seg-btn${input.footingType === 'round' ? ' active' : ''}`}
                onClick={() => set({ footingType: 'round' })}
              >
                Round caisson
              </button>
              <button
                role="tab"
                aria-selected={input.footingType === 'rect'}
                className={`seg-btn${input.footingType === 'rect' ? ' active' : ''}`}
                onClick={() => set({ footingType: 'rect' })}
              >
                Rectangular pier
              </button>
            </div>
          </label>

          <NumField
            label="Number of footings"
            value={input.numFootings}
            min={1}
            step={1}
            onChange={(v) => set({ numFootings: Math.max(1, Math.round(v)) })}
          />
          {input.footingType === 'round' ? (
            <FtInField
              label="Caisson diameter"
              value={input.caissonDiaFt}
              onChange={(v) => set({ caissonDiaFt: v })}
            />
          ) : (
            <>
              <FtInField
                label="Width (∥ sign face)"
                value={input.pierWidthFt}
                onChange={(v) => set({ pierWidthFt: v })}
              />
              <FtInField
                label="Length (⊥ sign face)"
                value={input.pierLengthFt}
                onChange={(v) => set({ pierLengthFt: v })}
              />
            </>
          )}
          <NumField
            label="Lateral soil resistance"
            suffix="psf/ft"
            value={input.lateralSoilPsf}
            min={0}
            onChange={(v) => set({ lateralSoilPsf: v })}
          />
          <NumField
            label="Allowable bearing"
            suffix="psf"
            value={input.bearingPsf}
            min={0}
            onChange={(v) => set({ bearingPsf: v })}
          />
          <NumField
            label="Sign + steel weight"
            suffix="lb"
            value={input.signWeightLb}
            min={0}
            placeholder="auto (15 psf × area)"
            allowEmpty
            onChange={() => undefined}
            onChangeNullable={(v) => set({ signWeightLb: v })}
          />
          <p className="hint span-2">
            Soil defaults are the UBC table 18-1-A minimums (200 psf/ft lateral,
            1,330 psf bearing). Use site geotech values when available.
          </p>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-caption">
          <label className="caption-toggle">
            <input
              type="checkbox"
              checked={input.mowPad.enabled}
              onChange={(e) => setMp({ enabled: e.target.checked })}
            />
            <span>Mow Pad</span>
          </label>
        </h2>
        {input.mowPad.enabled && (
          <div className="panel-body form-grid">
            <FtInField
              label="Length (along sign face)"
              value={input.mowPad.lengthFt}
              onChange={(v) => setMp({ lengthFt: v })}
            />
            <FtInField
              label="Width (along cabinet sides)"
              value={input.mowPad.widthFt}
              onChange={(v) => setMp({ widthFt: v })}
            />
            <NumField
              label="Pad height"
              suffix="in"
              value={input.mowPad.heightIn}
              min={0}
              onChange={(v) => setMp({ heightIn: v })}
            />
            <p className="hint span-2">
              Sits on top of the soil around the footing. Every pad dimension
              must clear the footing by at least 6" so the form frame bears on
              soil and the pour can't seep under it.
            </p>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-caption">
          <label className="caption-toggle">
            <input
              type="checkbox"
              checked={input.transition.enabled}
              onChange={(e) => setTr({ enabled: e.target.checked })}
            />
            <span>Transition Pipe</span>
          </label>
        </h2>
        {input.transition.enabled && (
          <div className="panel-body form-grid">
            <FtInField
              label="Splice height above grade"
              value={input.transition.spliceFt}
              allowEmpty
              placeholder="auto"
              onChange={() => undefined}
              onChangeNullable={(v) => setTr({ spliceFt: v })}
            />
            <p className="hint span-2">
              Splits the pole so no piece exceeds the {MAX_ORDER_FT} ft order /
              {' '}{MAX_HAUL_FT} ft haul limits. Standard splice: upper pipe sits
              2' inside the base pipe with 1/2" welded inner and outer ring
              plates. Leave blank to auto-place just below the lowest sign face.
            </p>
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-caption">
          <label className="caption-toggle">
            <input
              type="checkbox"
              checked={input.basePlate.enabled}
              onChange={(e) => setBp({ enabled: e.target.checked })}
            />
            <span>Base Plate &amp; Anchor Bolts</span>
          </label>
        </h2>
        {input.basePlate.enabled && (
          <div className="panel-body form-grid">
            <NumField
              label="Bolts per line"
              value={input.basePlate.boltsPerLine}
              min={1}
              step={1}
              onChange={(v) => setBp({ boltsPerLine: Math.max(1, Math.round(v)) })}
            />
            <NumField
              label="Concrete f'c"
              suffix="psi"
              value={input.basePlate.fcPsi}
              min={0}
              onChange={(v) => setBp({ fcPsi: v })}
            />
            <NumField
              label="Anchor bolt Ø"
              suffix="in"
              value={input.basePlate.boltDiaIn}
              min={0}
              placeholder="auto"
              allowEmpty
              onChange={() => undefined}
              onChangeNullable={(v) => setBp({ boltDiaIn: v })}
            />
            <NumField
              label="Fillet weld leg"
              suffix="in"
              value={input.basePlate.weldLegIn}
              min={0}
              onChange={(v) => setBp({ weldLegIn: v })}
            />
            <p className="hint span-2">
              A36 threaded rod with embedded end nut, two bolt lines front and
              back. Leave the diameter blank to auto-size to the next 1/8".
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
