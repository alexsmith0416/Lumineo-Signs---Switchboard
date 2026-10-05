import { useEffect, useRef, useState, type ReactNode } from "react";
import { useJobRow } from "../hooks/useJobRows";
import { formatShipTo, googleMapsUrl } from "../services/ship-to";
import { personByCode, pmForSalespersonCode } from "../services/sales-pm";
import WeatherChip from "./WeatherChip";

/** Copy text to the clipboard — the async API when the host allows it, else the
 *  old select-and-copy fallback (the Power Apps player iframe can block the API). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** The ship-to address as a link: click → Open in Google Maps / Copy address. */
function AddressLink({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="job-addr" ref={ref}>
      <button type="button" className="job-addr__link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span aria-hidden="true">📍</span> {address}
      </button>
      {copied && <span className="job-addr__copied">{copied === "ok" ? "Copied" : "Couldn't copy"}</span>}
      {open && (
        <div className="job-addr__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              window.open(googleMapsUrl(address), "_blank", "noopener");
              setOpen(false);
            }}
          >
            Open in Google Maps
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              setCopied((await copyText(address)) ? "ok" : "fail");
              window.setTimeout(() => setCopied(""), 1800);
            }}
          >
            Copy address
          </button>
        </div>
      )}
    </div>
  );
}

/** A section with a ▸ header that starts collapsed. */
function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="job-info__section">
      <button type="button" className="job-info__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="job-info__chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
        {title}
      </button>
      {open && <div className="job-info__body">{children}</div>}
    </div>
  );
}

/**
 * Job details for the card panel, below the stepper: the ship-to address (Maps /
 * Copy), weather on the card's day (install users), and collapsible Salesperson
 * & Project Manager. Everything comes from the Jobs list's row, so it matches
 * the list.
 */
export default function JobInfoSections({
  jobNo,
  showWeather = false,
  weatherDate,
  fallbackZip,
}: {
  jobNo: string;
  /** Weather for the scheduled day (install users). */
  showWeather?: boolean;
  /** The card's day, for the weather. */
  weatherDate?: Date;
  /** The card's own install ZIP when BC has no ship-to ZIP. */
  fallbackZip?: string;
}) {
  const row = useJobRow(jobNo);
  const address = formatShipTo(row?.shipTo);
  const zip = row?.shipTo.zip || fallbackZip || "";
  const sales = personByCode(row?.salespersonCode);
  const pm = pmForSalespersonCode(row?.salespersonCode);
  const salesName = sales?.name || row?.salespersonCode || row?.sales || "";

  return (
    <div className="job-info">
      <div className="job-info__row">
        <div className="job-targets__title">Ship-to address</div>
        {address ? <AddressLink address={address} /> : <span className="job-info__empty">No address in BC</span>}
      </div>
      {showWeather && weatherDate && zip && (
        <div className="job-info__row">
          <div className="job-targets__title">Weather · scheduled day</div>
          <WeatherChip zip={zip} forDate={weatherDate} size="expanded" />
        </div>
      )}
      <Collapsible title="Salesperson & Project Manager">
        <div className="job-targets__row">
          <span className="job-targets__label">Salesperson</span>
          <strong>{salesName || "—"}</strong>
        </div>
        <div className="job-targets__row">
          <span className="job-targets__label">Project manager</span>
          <strong>{pm?.name || "—"}</strong>
        </div>
      </Collapsible>
    </div>
  );
}
