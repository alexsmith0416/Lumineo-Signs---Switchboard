import type { PhotoChecklistItem } from "../types";

interface Props {
  items: PhotoChecklistItem[];
}

export default function PhotoChecklist({ items }: Props) {
  const remaining = items.filter((i) => i.required && !i.taken).length;
  return (
    <>
      <div className="checklist__summary">
        {remaining === 0 ? (
          <span className="checklist__summary--good">All required photos captured ✓</span>
        ) : (
          <span className="checklist__summary--pending">{remaining} required photo{remaining === 1 ? "" : "s"} still to take</span>
        )}
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.id} className={`checklist__row ${item.taken ? "is-done" : ""}`}>
            <span className={`checklist__check ${item.taken ? "is-done" : ""}`}>
              {item.taken ? "✓" : ""}
            </span>
            <span className="checklist__label">{item.label}</span>
            {item.required && <span className="checklist__req">required</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
