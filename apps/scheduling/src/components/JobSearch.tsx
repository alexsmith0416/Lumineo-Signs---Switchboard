import { useEffect, useState } from "react";
import { searchJobs, type BcJob } from "../shipping/bc-jobs";

interface JobSearchProps {
  onPick: (job: BcJob) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Enter with text typed but nothing picked — accept the raw job number as
   *  typed (a job BC search can't reach yet). Omitted = Enter does nothing. */
  onCommitText?: (text: string) => void;
  /** Escape / blur-away, so a caller can close an inline editor. */
  onCancel?: () => void;
}

/**
 * BC job lookup for adding shipment items. Type a job number / customer, pick a
 * result, and the parent prefills the item (job, customer, description). Backed
 * by a mock today; the same surface swaps to a live BC query later.
 */
export default function JobSearch({ onPick, placeholder, autoFocus, onCommitText, onCancel }: JobSearchProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<BcJob[]>([]);

  // Debounced async search (live BC via Dataverse, mock fallback).
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      void searchJobs(q).then((r) => {
        if (!cancelled) setResults(r);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="job-search">
      <input
        className="form-field__input job-search__input"
        type="text"
        value={q}
        autoFocus={autoFocus}
        placeholder={placeholder ?? "Search BC job # or customer…"}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Let a menu click land first (it fires on mousedown).
          setTimeout(() => {
            setOpen(false);
            onCancel?.();
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onCommitText) {
            e.preventDefault();
            const text = q.trim();
            if (text) onCommitText(text);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
      />
      {open && results.length > 0 && (
        <div className="job-search__menu">
          {results.map((j) => (
            <button
              key={j.jobNo}
              type="button"
              className="job-search__option"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(j);
                setQ("");
                setOpen(false);
              }}
            >
              <span className="job-search__jobno">{j.jobNo}</span>
              <span className="job-search__cust">{j.customerName}</span>
              <span className="job-search__desc">{j.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
