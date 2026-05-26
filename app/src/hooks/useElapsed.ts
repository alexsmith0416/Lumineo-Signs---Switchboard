import { useEffect, useState } from "react";

export function useElapsed(startIso: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startIso]);

  if (!startIso) return 0;
  const start = new Date(startIso).getTime();
  return Math.max(0, now - start);
}
