import type { Birthday } from "../types";

interface Props {
  birthdays: Birthday[];
}

export default function BirthdayStrip({ birthdays }: Props) {
  return (
    <div className="birthdays">
      <span className="birthdays__title">
        <span aria-hidden="true">🎂</span> Upcoming birthdays
      </span>
      <div className="birthdays__list">
        {birthdays.map((b, i) => (
          <button key={i} type="button" className="birthday" title={`Send ${b.name} a message`}>
            <span className="birthday__avatar">{b.initials}</span>
            <span className="birthday__name">{b.name}</span>
            <span className="birthday__when">· {b.whenLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
