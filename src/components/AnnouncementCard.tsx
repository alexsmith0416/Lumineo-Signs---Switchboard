import { useState } from "react";
import type { Announcement } from "../types";

interface Props {
  announcement: Announcement;
}

export default function AnnouncementCard({ announcement }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="announcement" role="status">
      <span className="announcement__icon" aria-hidden="true">📣</span>
      <span className="announcement__body">
        <strong>Announcement</strong>
        {announcement.body}
      </span>
      <button
        type="button"
        className="announcement__dismiss"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}
