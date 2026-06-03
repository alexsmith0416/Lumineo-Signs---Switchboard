import { useMemo } from 'react';

import { aggregateForBC, round2, round4, type ComputedProject, type Project } from '../lib/engine';
import { downloadBCExport } from '../lib/bcExport';

interface Props {
  project: Project;
  computed: ComputedProject;
}

export function BCExportView({ project, computed }: Props) {
  const bc = useMemo(() => aggregateForBC(computed), [computed]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--color-navy)', margin: 0 }}>BC Export · {project.jobNumber || '(no job #)'}</h2>
        <button className="primary" onClick={() => downloadBCExport(computed)}>Download .xlsx</button>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Aggregated into Business Central's BCI + BCL import shape. Materials roll up by item number,
        labor rolls up by work code.
      </p>

      <div className="section-head">
        <h4>BCI · materials ({bc.bci.length})</h4>
        <span className="small muted">Subtotal ${round2(bc.materialTotal).toLocaleString()}</span>
      </div>
      <table className="lines-table">
        <thead>
          <tr>
            <th>Job #</th>
            <th>Task #</th>
            <th>Item #</th>
            <th>Description</th>
            <th className="num">Unit Cost</th>
            <th className="num">Profit %</th>
            <th className="num">Unit Price</th>
            <th className="num">Qty</th>
          </tr>
        </thead>
        <tbody>
          {bc.bci.length === 0 && (
            <tr><td colSpan={8} className="muted small">No material lines.</td></tr>
          )}
          {bc.bci.map((r, i) => (
            <tr key={i}>
              <td>{r.jobNumber}</td>
              <td>{r.taskNumber}</td>
              <td>{r.itemNumber}</td>
              <td>{r.description}</td>
              <td className="num">${round4(r.unitCost)}</td>
              <td className="num">{r.profitPct}</td>
              <td className="num">${round4(r.unitPrice)}</td>
              <td className="num">{round4(r.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-head" style={{ marginTop: 32 }}>
        <h4>BCL · labor ({bc.bcl.length})</h4>
        <span className="small muted">Subtotal ${round2(bc.laborTotal).toLocaleString()}</span>
      </div>
      <table className="lines-table">
        <thead>
          <tr>
            <th>Job #</th>
            <th>Resource #</th>
            <th className="num">Run Time (hrs)</th>
          </tr>
        </thead>
        <tbody>
          {bc.bcl.length === 0 && (
            <tr><td colSpan={3} className="muted small">No labor lines.</td></tr>
          )}
          {bc.bcl.map((r, i) => (
            <tr key={i}>
              <td>{r.jobNumber}</td>
              <td>{r.resourceNumber}</td>
              <td className="num">{round4(r.runTime)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals-bar">
        <div><span className="label">BCI materials</span> ${round2(bc.materialTotal).toLocaleString()}</div>
        <div><span className="label">BCL labor</span> ${round2(bc.laborTotal).toLocaleString()}</div>
        <div className="grand-total">${round2(bc.total).toLocaleString()}</div>
      </div>
    </div>
  );
}
