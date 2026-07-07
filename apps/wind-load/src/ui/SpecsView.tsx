import { SPEC_NOTES } from '../data/tables';

// Standard specification notes (from the workbook's "Spec" sheet) — the boiler
// plate that accompanies a sign structure calc package.
export function SpecsView() {
  return (
    <div className="specs-grid">
      <section className="panel">
        <h2 className="panel-caption">Steel</h2>
        <div className="panel-body">
          <ul className="spec-list">
            {SPEC_NOTES.steel.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>
      <section className="panel">
        <h2 className="panel-caption">Welding</h2>
        <div className="panel-body">
          <ul className="spec-list">
            {SPEC_NOTES.welding.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>
      <section className="panel">
        <h2 className="panel-caption">Concrete</h2>
        <div className="panel-body">
          <ul className="spec-list">
            {SPEC_NOTES.concrete.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
