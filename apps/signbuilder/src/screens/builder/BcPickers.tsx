import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/ui";
import type { BcJob, BcOpportunity } from "../../domain/types";
import { bcLink, POLL_MS, syncMessage, type SyncKind } from "../../services/bc-link";

// One copy from BC per list per app session (or after 10 minutes) — a picker
// asks when it opens; Refresh asks again.
const lastSync: Partial<Record<SyncKind, number>> = {};
const SYNC_AGAIN_MS = 10 * 60_000;

/** Asks the kind's flow to copy BC now, follows the request, then bumps the list. */
function useBcSync(kind: SyncKind, userName: string) {
  const [state, setState] = useState<{ phase: string; text: string } | null>(null);
  const [bump, setBump] = useState(0);
  const alive = useRef(true);
  const refresh = async () => {
    setState({ phase: "waiting", text: "Asking BC…" });
    try {
      const id = await bcLink().requestSync(kind, userName);
      const started = Date.now();
      lastSync[kind] = started;
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive.current) return;
        const m = syncMessage(await bcLink().readSyncRequest(id), Date.now() - started, kind);
        setState(m);
        if (m.phase === "done" || m.phase === "failed") break;
      }
      setBump((b) => b + 1);
    } catch (e) {
      setState({ phase: "failed", text: e instanceof Error ? e.message : String(e) });
    }
  };
  useEffect(() => {
    alive.current = true;
    if (Date.now() - (lastSync[kind] ?? 0) > SYNC_AGAIN_MS) void refresh();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const busy = state?.phase === "waiting" || state?.phase === "running";
  return { state, bump, refresh, busy };
}

function useSearch<T>(search: (q: string) => Promise<T[]>, query: string, bump: number) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      search(query)
        .then((r) => alive && (setRows(r), setError("")))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, bump]);
  return { rows, error };
}

function SearchBar({ query, setQuery, placeholder, sync }: { query: string; setQuery: (q: string) => void; placeholder: string; sync: ReturnType<typeof useBcSync> }) {
  return (
    <>
      <div className="sbp-row" style={{ gap: 8, marginBottom: 8 }}>
        <input className="sbp-input" autoFocus style={{ flex: 1 }} placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn-secondary" disabled={sync.busy} onClick={() => void sync.refresh()}>
          Refresh from BC
        </button>
      </div>
      {sync.state && (
        <div className={`sbp-muted${sync.state.phase === "failed" ? " sbp-text-error" : ""}`} style={{ fontSize: 12, marginBottom: 6 }}>
          {sync.state.text}
        </div>
      )}
    </>
  );
}

/** Pick the spec's BC opportunity. Asks BC for fresh opportunities when it opens. */
export function OpportunityPicker({ userName, onPick, onClose }: { userName: string; onPick: (o: BcOpportunity) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const sync = useBcSync("sbopportunities", userName);
  const { rows, error } = useSearch((q) => bcLink().searchOpportunities(q), query, sync.bump);

  return (
    <Modal title="Pick the opportunity" onClose={onClose} wide>
      <SearchBar query={query} setQuery={setQuery} placeholder="Opportunity no., description, company or contact…" sync={sync} />
      {error && <div className="sbp-banner sbp-banner--error">{error}</div>}
      {!query && <div className="sbp-muted" style={{ fontSize: 12, marginBottom: 6 }}>Open opportunities, newest first — type to search all of them.</div>}
      <div className="sbp-picker-list">
        {rows === null && !error && <div className="sbp-muted">Loading…</div>}
        {rows?.length === 0 && <div className="sbp-muted">No opportunities found{query ? " — try another word" : ""}.</div>}
        {rows?.map((o) => (
          <button key={o.no} type="button" className="sbp-picker-row" onClick={() => onPick(o)}>
            <div className="sbp-row" style={{ gap: 8 }}>
              <b>{o.no}</b>
              <span style={{ flex: 1 }}>{o.description}</span>
              <span className="sbp-pill">{o.status || (o.closed ? "Closed" : "Open")}</span>
              {o.projectNo && <span className="sbp-pill sbp-pill--approved">Project {o.projectNo}</span>}
            </div>
            <div className="sbp-muted" style={{ fontSize: 12 }}>
              {[o.companyName, o.contactName, o.salespersonCode && `Salesperson ${o.salespersonCode}`, o.creationDate].filter(Boolean).join(" · ")}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Pick the spec's BC project — Planning and Quote ones too, not just Open. */
export function JobPicker({ userName, onPick, onClose }: { userName: string; onPick: (j: BcJob) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const sync = useBcSync("sbjobs", userName);
  const { rows, error } = useSearch((q) => bcLink().searchJobs(q), query, sync.bump);
  return (
    <Modal title="Pick the project (job)" onClose={onClose} wide>
      <SearchBar query={query} setQuery={setQuery} placeholder="Job no., customer or description…" sync={sync} />
      {error && <div className="sbp-banner sbp-banner--error">{error}</div>}
      {!query && <div className="sbp-muted" style={{ fontSize: 12, marginBottom: 6 }}>Projects that aren't completed — Planning, Quote and Open — newest first.</div>}
      <div className="sbp-picker-list">
        {rows === null && !error && <div className="sbp-muted">Loading…</div>}
        {rows?.length === 0 && <div className="sbp-muted">No projects found.</div>}
        {rows?.map((j) => (
          <button key={j.no} type="button" className="sbp-picker-row" onClick={() => onPick(j)}>
            <div className="sbp-row" style={{ gap: 8 }}>
              <b>{j.no}</b>
              <span style={{ flex: 1 }}>{j.name}</span>
              {j.status && <span className={`sbp-pill${j.status.toLowerCase() === "open" ? " sbp-pill--approved" : ""}`}>{j.status}</span>}
            </div>
            <div className="sbp-muted" style={{ fontSize: 12 }}>
              {[j.description, j.personResponsible && `Responsible ${j.personResponsible}`, j.creationDate].filter(Boolean).join(" · ")}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
