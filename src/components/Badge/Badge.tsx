import { getBadgeColor, COLOR_MAP } from '../../data/statusColors';
import type { BadgeColor } from '../../data/statusColors';

interface Props {
  field: string;
  value: string;
  color?: BadgeColor;
}

export default function Badge({ field, value, color }: Props) {
  const c = color ?? getBadgeColor(field, value);
  const { bg, text } = COLOR_MAP[c];
  return (
    <span className="badge" style={{ background: bg, color: text }}>
      {value}
    </span>
  );
}
