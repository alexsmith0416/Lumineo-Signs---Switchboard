import { useJobPoSummary } from "../store/po-receiving-store";

/**
 * "Materials ready" chip — every open PO on the job is received. Shown near the
 * top of the card hover preview and the card panel so it's seen at a glance
 * (the PO detail sits lower down / in a collapsed section).
 */
export function MaterialsReadyChip({ jobNo, style }: { jobNo: string | undefined; style?: React.CSSProperties }) {
  const sum = useJobPoSummary(jobNo);
  if (!sum?.materialsReady) return null;
  return (
    <span
      className="wh-ready"
      style={{ display: "inline-block", ...style }}
      title={sum.locations.length ? `Stored at: ${sum.locations.join(", ")}` : "Every PO on this job is received"}
    >
      📦 Materials ready
    </span>
  );
}
