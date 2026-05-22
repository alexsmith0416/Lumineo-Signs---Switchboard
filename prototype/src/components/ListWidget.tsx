import type { ListItem } from "../types";

interface Props {
  items: ListItem[];
  emptyText?: string;
}

export default function ListWidget({ items, emptyText }: Props) {
  if (items.length === 0) {
    return <div className="listwidget__empty">{emptyText ?? "Nothing here right now."}</div>;
  }
  return (
    <ul className="listwidget">
      {items.map((item) => (
        <li key={item.id} className="listwidget__row">
          {item.icon && <span className="listwidget__icon">{item.icon}</span>}
          <div className="listwidget__text">
            <div className="listwidget__primary">{item.primary}</div>
            {item.secondary && <div className="listwidget__secondary">{item.secondary}</div>}
          </div>
          <div className="listwidget__right">
            {item.badge && (
              <span className={`listwidget__badge listwidget__badge--${item.badge.tone}`}>
                {item.badge.text}
              </span>
            )}
            {item.meta && <span className="listwidget__meta">{item.meta}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
