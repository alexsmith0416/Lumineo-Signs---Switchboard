import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { posOf, statusIn, summaryOf, usePoReceivingStore, useJobPoSummary } from "../../store/po-receiving-store";
import { summaryText, type JobPoSummary, type WarehousePO } from "../../services/po-receiving";
import { PoRow, ReceiveDialog } from "./WarehouseView";

const W = 620;

/**
 * A job's POs in a pop-up (Jobs list → POs cell): each PO's Vendor Status and
 * deliveries; Admin / Ops change the status, receivers record a delivery.
 */
export function JobPosPopover({
  jobNo,
  title,
  anchor,
  canReceive,
  canSetStatus,
  userName,
  homeSite = "",
  onClose,
}: {
  jobNo: string;
  title: string;
  anchor: DOMRect;
  canReceive: boolean;
  canSetStatus: boolean;
  userName: string;
  /** The receiver's site — Receive defaults to it. */
  homeSite?: string;
  onClose: () => void;
}) {
  const pos = usePoReceivingStore((s) => s.pos);
  const receipts = usePoReceivingStore((s) => s.receipts);
  const deliveries = usePoReceivingStore((s) => s.deliveries);
  const loaded = usePoReceivingStore((s) => s.loaded);
  const [receiving, setReceiving] = useState<WarehousePO | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !receiving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, receiving]);

  const snap = { pos, receipts, deliveries };
  const list = posOf(snap, jobNo);
  const sum = summaryOf(snap, jobNo);
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - W - 8));
  const below = anchor.bottom + 4;
  const top = below + 320 > window.innerHeight ? Math.max(8, anchor.top - 324) : below;
  const store = usePoReceivingStore.getState();

  return createPortal(
    <>
      <div className="wh-pop__backdrop" onClick={onClose} />
      <div className="wh-pop" style={{ left, top, width: Math.min(W, window.innerWidth - 16) }} onClick={(e) => e.stopPropagation()}>
        <header className="wh-job__head">
          <span className="wh-job__no">{jobNo}</span>
          <span className="wh-job__name">{title}</span>
          <span className="wh-job__sum">{summaryText(sum)}</span>
          {sum.materialsReady && <span className="wh-ready">Materials ready</span>}
        </header>
        {!loaded ? (
          <div className="wh-empty wh-empty--small">Loading…</div>
        ) : list.length ? (
          <ul className="wh-list">
            {list.map((po) => (
              <PoRow
                key={po.poNo}
                po={po}
                status={statusIn(snap, po.poNo)}
                deliveries={deliveries.get(po.poNo) ?? []}
                canReceive={canReceive}
                canSetStatus={canSetStatus}
                onReceive={() => setReceiving(po)}
                onStatus={(st) => void store.setStatus(po, st, userName)}
                onRemove={(d) => void store.removeDelivery(d)}
                onEditDelivery={(d) => void store.updateDelivery(d)}
                onPickJob={() => {}}
              />
            ))}
          </ul>
        ) : (
          <div className="wh-empty wh-empty--small">No purchase orders in BC</div>
        )}
      </div>
      {receiving && (
        <ReceiveDialog
          po={receiving}
          defaultSite={homeSite}
          onCancel={() => setReceiving(null)}
          onSave={(d) => {
            void store.receive(receiving, d, userName);
            setReceiving(null);
          }}
        />
      )}
    </>,
    document.body,
  );
}

/** Jobs list POs cell: "3 POs · 1 partial · 1 received", green when Materials ready. */
export function PosCell({ jobNo }: { jobNo: string | undefined }) {
  const sum = useJobPoSummary(jobNo);
  if (!sum) return null;
  const text = summaryText(sum);
  if (!text) return null;
  return <span className={`wh-chip wh-chip--${chipTone(sum)}`}>{sum.materialsReady ? `✓ ${text}` : text}</span>;
}

function chipTone(s: JobPoSummary): string {
  if (s.materialsReady) return "ready";
  if (s.partial || s.received) return "partial";
  return s.open ? "open" : "closed";
}
