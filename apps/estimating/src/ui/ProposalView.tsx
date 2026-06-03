import { round2 } from '../lib/engine';
import type { PieceProposalLine } from '../lib/proposal';
import type { Project } from '../repo';

interface Props {
  lines: readonly PieceProposalLine[];
  total: number;
  project: Project;
}

export function ProposalView({ lines, total, project }: Props) {
  return (
    <div>
      <h2 style={{ color: 'var(--color-navy)', marginTop: 0 }}>Proposal · {project.jobName || project.jobNumber}</h2>
      <p className="muted">{project.description || 'No description.'}</p>
      <table className="lines-table" style={{ marginTop: 24 }}>
        <thead>
          <tr>
            <th>Sign piece</th>
            <th className="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 && (
            <tr><td colSpan={2} className="muted small">No pieces in this estimate yet.</td></tr>
          )}
          {lines.map((line, i) => (
            <tr key={i}>
              <td>{line.description}</td>
              <td className="num">${round2(line.subtotal).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        {lines.length > 0 && (
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700, color: 'var(--color-navy)' }}>Estimate total</td>
              <td className="num" style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                ${round2(total).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
