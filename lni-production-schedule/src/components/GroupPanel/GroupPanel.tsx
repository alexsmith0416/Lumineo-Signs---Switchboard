import { FIELD_DEFS } from '../../data/fieldDefs';

const GROUP_FIELDS = Object.keys(FIELD_DEFS).filter(
  k => FIELD_DEFS[k].type !== 'readonly' && FIELD_DEFS[k].type !== 'multiline'
);

interface Props {
  groupField: string | null;
  onChange: (field: string | null) => void;
  onClose: () => void;
}

export default function GroupPanel({ groupField, onChange, onClose }: Props) {
  const pick = (f: string | null) => { onChange(f); onClose(); };

  return (
    <div className="panel-dropdown" onClick={e => e.stopPropagation()}>
      <div className="panel-header">
        <span>Group by</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="group-list">
        <div
          className={`group-opt${groupField === null ? ' active' : ''}`}
          onClick={() => pick(null)}
        >
          None
        </div>
        {GROUP_FIELDS.map(k => (
          <div
            key={k}
            className={`group-opt${groupField === k ? ' active' : ''}`}
            onClick={() => pick(k)}
          >
            {FIELD_DEFS[k].label}
          </div>
        ))}
      </div>
    </div>
  );
}
