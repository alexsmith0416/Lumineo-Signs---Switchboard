import { useEffect, useMemo, useState } from "react";
import { usePoReceivingStore, statusIn, summaryOf } from "../../store/po-receiving-store";
import { useJobTrackingStore } from "../../store/job-tracking-store";
import { ARCHIVED, bcPurchaseOrderUrl, formatOrderDate } from "../../services/job-pos";
import {
  VENDOR_STATUSES,
  isPartial,
  isReceived,
  searchPOs,
  summaryText,
  workLists,
  type PoDelivery,
  type WarehousePO,
} from "../../services/po-receiving";
import { STORAGE_LOCATIONS } from "../jobs/jobs-editable";

/**
 * Warehouse Management (Oct 8, 2026) — receiving against purchase orders.
 * Receivers (Admin / Ops, or a login granted "Receiving") find a PO by PO #,
 * job #, vendor or job name, see the job's other POs, and record what came
 * in (date, storage location, notes; partial or final). Admin / Ops also set
 * the Vendor Status by hand. Nothing here posts the receipt in BC.
 */
export default function WarehouseView({
  canReceive,
  canSetStatus,
  userName,
}: {
  canReceive: boolean;
  /** Admin / Ops: set any Vendor Status, remove a delivery. */
  canSetStatus: boolean;
  userName: string;
}) {
  const { pos, receipts, deliveries, loaded, loading, error, loadedAt, load } = usePoReceivingStore();
  const bcJobs = useJobTrackingStore((s) => s.bcJobs);
  const [tab, setTab] = useState<"job" | "stock">("job");
  const [query, setQuery] = useState("");
  const [receiving, setReceiving] = useState<WarehousePO | null>(null);

  useEffect(() => {
    void load();
    void useJobTrackingStore.getState().load();
  }, [load]);

  const snap = useMemo(() => ({ pos, receipts, deliveries }), [pos, receipts, deliveries]);
  const nameByJob = useMemo(() => new Map(bcJobs.map((j) => [j.jobNo, j.name])), [bcJobs]);
  const nameOf = (jobNo: string) => nameByJob.get(jobNo) ?? "";
  const statusOf = (poNo: string) => statusIn(snap, poNo);
  const deliveriesOf = (poNo: string) => deliveries.get(poNo) ?? [];

  const results = useMemo(() => searchPOs(pos, query, nameOf), [pos, query, nameByJob]); // eslint-disable-line react-hooks/exhaustive-deps
  const lists = useMemo(
    () =>
      workLists(
        pos,
        (p) => statusIn(snap, p),
        (p) => snap.deliveries.get(p) ?? [],
        todayYmd(),
      ),
    [pos, snap],
  );

  const row = (po: WarehousePO, opts: { showJob?: boolean; highlight?: boolean } = {}) => (
    <PoRow
      key={po.poNo}
      po={po}
      status={statusOf(po.poNo)}
      deliveries={deliveriesOf(po.poNo)}
      jobName={opts.showJob ? nameOf(po.jobNo) : undefined}
      highlight={opts.highlight}
      canReceive={canReceive}
      canSetStatus={canSetStatus}
      onReceive={() => setReceiving(po)}
      onStatus={(st) => void usePoReceivingStore.getState().setStatus(po, st, userName)}
      onRemove={(d) => void usePoReceivingStore.getState().removeDelivery(d)}
      onPickJob={() => setQuery(po.jobNo)}
    />
  );

  return (
    <div className="wh">
      <div className="wh-toolbar">
        <div className="wh-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "job"}
            className={`wh-tab${tab === "job" ? " wh-tab--on" : ""}`}
            onClick={() => setTab("job")}
          >
            Job POs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "stock"}
            className={`wh-tab${tab === "stock" ? " wh-tab--on" : ""}`}
            onClick={() => setTab("stock")}
          >
            Stock POs
          </button>
        </div>
        {tab === "job" && (
          <input
            className="wh-search"
            type="search"
            placeholder="Search PO #, job #, vendor or job name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        )}
        <button type="button" className="btn-secondary wh-refresh" disabled={loading} onClick={() => void load(true)}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {loadedAt && (
          <span className="wh-updated">
            Updated{" "}
            {loadedAt.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {error && <div className="wh-error">Couldn't load the POs: {error}</div>}

      {tab === "stock" ? (
        <div className="wh-empty">
          Stock POs (not tied to a job) aren't synced from Business Central yet — they're coming with the BC update.
        </div>
      ) : !loaded ? (
        <div className="wh-empty">Loading purchase orders…</div>
      ) : query.trim() ? (
        results.length ? (
          results.map((r) => {
            const sum = summaryOf(snap, r.jobNo);
            return (
              <section key={r.jobNo} className="wh-job">
                <header className="wh-job__head">
                  <span className="wh-job__no">{r.jobNo}</span>
                  <span className="wh-job__name">{nameOf(r.jobNo)}</span>
                  <span className="wh-job__sum">{summaryText(sum)}</span>
                  {sum.materialsReady && <span className="wh-ready">Materials ready</span>}
                </header>
                <ul className="wh-list">{r.pos.map((p) => row(p, { highlight: p.poNo === r.matchedPo }))}</ul>
              </section>
            );
          })
        ) : (
          <div className="wh-empty">No POs match “{query.trim()}”.</div>
        )
      ) : (
        <div className="wh-lists">
          <WorkList
            title="Partially received"
            hint="Waiting on the rest"
            items={lists.partial}
            render={(p) => row(p, { showJob: true })}
          />
          <WorkList
            title="Waiting to arrive"
            hint="Open POs, nothing received yet — oldest first"
            items={lists.waiting}
            render={(p) => row(p, { showJob: true })}
          />
          <WorkList
            title="Recently received"
            hint="Last 7 days"
            items={lists.recent}
            render={(p) => row(p, { showJob: true })}
          />
        </div>
      )}

      {receiving && (
        <ReceiveDialog
          po={receiving}
          onCancel={() => setReceiving(null)}
          onSave={(d) => {
            void usePoReceivingStore.getState().receive(receiving, d, userName);
            setReceiving(null);
          }}
        />
      )}
    </div>
  );
}

function WorkList({
  title,
  hint,
  items,
  render,
}: {
  title: string;
  hint: string;
  items: WarehousePO[];
  render: (po: WarehousePO) => JSX.Element;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 25);
  return (
    <section className="wh-job">
      <header className="wh-job__head">
        <span className="wh-job__no">{title}</span>
        <span className="wh-job__name">{hint}</span>
        <span className="wh-job__sum">{items.length}</span>
      </header>
      {items.length ? (
        <ul className="wh-list">{shown.map(render)}</ul>
      ) : (
        <div className="wh-empty wh-empty--small">None</div>
      )}
      {items.length > shown.length && (
        <button type="button" className="wh-more" onClick={() => setAll(true)}>
          Show all {items.length}
        </button>
      )}
    </section>
  );
}

function PoRow({
  po,
  status,
  deliveries,
  jobName,
  highlight,
  canReceive,
  canSetStatus,
  onReceive,
  onStatus,
  onRemove,
  onPickJob,
}: {
  po: WarehousePO;
  status: string;
  deliveries: readonly PoDelivery[];
  /** Shown in the work lists (rows from many jobs). */
  jobName?: string;
  highlight?: boolean;
  canReceive: boolean;
  canSetStatus: boolean;
  onReceive: () => void;
  onStatus: (status: string) => void;
  onRemove: (d: PoDelivery) => void;
  onPickJob: () => void;
}) {
  const archived = po.status === ARCHIVED;
  const tone = isReceived(status) ? "received" : isPartial(status) ? "partial" : status ? "set" : "none";
  return (
    <li className={`wh-po${highlight ? " wh-po--match" : ""}${archived ? " wh-po--archived" : ""}`}>
      <div className="wh-po__top">
        <a
          className="wh-po__no"
          href={bcPurchaseOrderUrl(po)}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Business Central"
        >
          {po.poNo}
        </a>
        <span className="wh-po__vendor">{po.vendorName || po.vendorNo || "—"}</span>
        {jobName !== undefined && (
          <button type="button" className="wh-po__job" onClick={onPickJob} title="Show this job's POs">
            {po.jobNo}
            {jobName ? ` · ${jobName}` : ""}
          </button>
        )}
        <span className="wh-po__date">Ordered {po.orderDate ? formatOrderDate(po.orderDate) : "—"}</span>
        {archived && <span className="wh-po__closed">Closed in BC</span>}
        <span className="wh-po__spacer" />
        {canSetStatus ? (
          <select
            className={`wh-status wh-status--${tone}`}
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            aria-label="Vendor status"
          >
            <option value="">No status</option>
            {[...VENDOR_STATUSES, ...(status && !VENDOR_STATUSES.includes(status) ? [status] : [])].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          status && <span className={`wh-status wh-status--${tone}`}>{status}</span>
        )}
        {canReceive && !archived && !isReceived(status) && (
          <button type="button" className="btn-primary wh-receive" onClick={onReceive}>
            Receive
          </button>
        )}
      </div>
      {deliveries.length > 0 && (
        <ul className="wh-deliveries">
          {deliveries.map((d) => (
            <li key={d.id} className="wh-delivery">
              <span className="wh-delivery__date">{formatOrderDate(d.date)}</span>
              <span className="wh-delivery__loc">{d.location || "No location"}</span>
              <span className="wh-delivery__kind">{d.final ? "Final" : "Partial"}</span>
              {d.receivedBy && <span className="wh-delivery__by">{d.receivedBy}</span>}
              {d.notes && <span className="wh-delivery__notes">{d.notes}</span>}
              {canSetStatus && (
                <button
                  type="button"
                  className="wh-delivery__remove"
                  aria-label="Remove this delivery"
                  title="Remove this delivery"
                  onClick={() => {
                    if (window.confirm(`Remove the ${formatOrderDate(d.date)} delivery on ${po.poNo}?`)) onRemove(d);
                  }}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ReceiveDialog({
  po,
  onCancel,
  onSave,
}: {
  po: WarehousePO;
  onCancel: () => void;
  onSave: (d: { date: string; location: string; notes: string; final: boolean }) => void;
}) {
  const [date, setDate] = useState(todayYmd());
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [final, setFinal] = useState(true);
  return (
    <div className="wh-modal" role="dialog" aria-modal="true" aria-label={`Receive ${po.poNo}`} onClick={onCancel}>
      <form
        className="wh-modal__card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ date, location, notes: notes.trim(), final });
        }}
      >
        <h2 className="wh-modal__title">
          Receive {po.poNo}
          <span className="wh-modal__sub">
            {po.vendorName} · {po.jobNo}
          </span>
        </h2>
        <label className="wh-field">
          <span>Date received</span>
          <input type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="wh-field">
          <span>Storage location</span>
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">—</option>
            {STORAGE_LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="wh-field">
          <span>Notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Damage, short items, what's still coming…"
          />
        </label>
        <fieldset className="wh-kind">
          <label>
            <input type="radio" checked={final} onChange={() => setFinal(true)} /> Everything on the PO is here —{" "}
            <b>Received</b>
          </label>
          <label>
            <input type="radio" checked={!final} onChange={() => setFinal(false)} /> Part of it —{" "}
            <b>Partially Received</b>
          </label>
        </fieldset>
        <div className="wh-modal__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
