import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../components/ui";
import type { DescPush, JobDescriptions, SignLine, Spec } from "../../domain/types";
import { buildFromTemplates, buildProduction } from "../../engine/descriptions";
import { evaluate } from "../../engine/flow";
import { bcLink, POLL_MS, pushMessage } from "../../services/bc-link";
import { useSetupStore } from "../../store/setup-store";
import { DescriptionText } from "./DescriptionPreview";

type Which = "production" | "field";
const NAMES: Record<Which, string> = { production: "Production Description", field: "Field Description" };
const same = (a: string, b: string) => a.replace(/\r\n/g, "\n").trim() === b.replace(/\r\n/g, "\n").trim();

/** Generate to Project: the new descriptions next to what the BC project has
 *  now; tick which to replace and send — a flow writes them to BC and the
 *  status comes back here. */
export default function GenerateToProject({
  spec,
  lines,
  userName,
  onSent,
  onPickJob,
  onClose,
}: {
  spec: Spec;
  lines: SignLine[];
  userName: string;
  /** Called once BC has the descriptions (stamps the spec). */
  onSent: () => void;
  onPickJob: () => void;
  onClose: () => void;
}) {
  const idx = useSetupStore((s) => s.idx)!;
  const [current, setCurrent] = useState<JobDescriptions | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [send, setSend] = useState<Record<Which, boolean>>({ production: true, field: true });
  const [status, setStatus] = useState<{ phase: "waiting" | "done" | "failed"; text: string } | null>(null);
  const [history, setHistory] = useState<DescPush[]>([]);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const next = useMemo(
    () => ({ production: buildProduction(idx, spec, lines), field: buildFromTemplates(idx, spec, lines, "field") }),
    [idx, spec, lines],
  );
  const open = useMemo(() => {
    let missing = 0;
    let surveys = 0;
    for (const l of lines) {
      const ev = evaluate(idx, l, "full");
      missing += ev.missingRequired;
      surveys += ev.openSurveys;
    }
    return { missing, surveys };
  }, [idx, lines]);

  useEffect(() => {
    if (!spec.jobNo) return;
    let ok = true;
    setCurrent(undefined);
    bcLink()
      .getJobDescriptions(spec.jobNo)
      .then((d) => {
        if (!ok) return;
        setCurrent(d);
        // Untick what wouldn't change.
        setSend({ production: !d || !same(d.production, next.production), field: !d || !same(d.field, next.field) });
      })
      .catch((e) => ok && (setLoadError(e instanceof Error ? e.message : String(e)), setCurrent(null)));
    void bcLink().pushesForSpec(spec.id).then((h) => ok && setHistory(h.slice(0, 5)));
    return () => {
      ok = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.jobNo, spec.id]);

  const run = async () => {
    setStatus({ phase: "waiting", text: "Sending to BC…" });
    try {
      const id = await bcLink().queueDescriptions({
        jobNo: spec.jobNo,
        specId: spec.id,
        production: send.production ? next.production : undefined,
        field: send.field ? next.field : undefined,
        requestedBy: userName,
      });
      const started = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!alive.current) return;
        const m = pushMessage(await bcLink().readPush(id), Date.now() - started);
        setStatus(m);
        if (m.phase === "done") {
          onSent();
          break;
        }
        if (m.phase === "failed") break;
      }
      void bcLink().pushesForSpec(spec.id).then((h) => alive.current && setHistory(h.slice(0, 5)));
    } catch (e) {
      setStatus({ phase: "failed", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const busy = status?.phase === "waiting";
  const none = !send.production && !send.field;

  return (
    <Modal
      title={spec.jobNo ? `Generate to Project ${spec.jobNo}` : "Generate to Project"}
      onClose={onClose}
      wide
      actions={
        spec.jobNo && status?.phase !== "done" ? (
          <button type="button" className="btn-primary" disabled={busy || none || lines.length === 0 || current === undefined} onClick={() => void run()}>
            {status?.phase === "failed" ? "Try again" : "Send to BC"}
          </button>
        ) : null
      }
    >
      {!spec.jobNo ? (
        <div className="sbp-banner sbp-banner--warn">
          This spec isn't linked to a BC project yet.{" "}
          <button type="button" className="btn-secondary" onClick={onPickJob}>
            Pick the project…
          </button>
        </div>
      ) : (
        <>
          {lines.length === 0 && <div className="sbp-banner sbp-banner--warn">Add at least one sign first.</div>}
          {(open.missing > 0 || open.surveys > 0) && (
            <div className="sbp-banner sbp-banner--warn">
              {open.missing > 0 && <>{open.missing} required answer{open.missing === 1 ? " is" : "s are"} still blank. </>}
              {open.surveys > 0 && <>{open.surveys} survey{open.surveys === 1 ? " is" : "s are"} still open (listed under SURVEY NEEDED). </>}
              You can still send — the descriptions say what's missing.
            </div>
          )}
          {loadError && <div className="sbp-banner sbp-banner--error">Couldn't read BC's current descriptions: {loadError}</div>}
          {(["production", "field"] as Which[]).map((w) => {
            const now = current ? current[w] : "";
            const unchanged = current !== undefined && same(now, next[w]);
            return (
              <div key={w} className="sbp-gen-pair">
                <label className="sbp-check" style={{ fontWeight: 800, marginBottom: 6 }}>
                  <input type="checkbox" checked={send[w]} disabled={busy || status?.phase === "done"} onChange={(e) => setSend({ ...send, [w]: e.target.checked })} /> Replace the {NAMES[w]}
                  {unchanged && <span className="sbp-pill" style={{ marginLeft: 6 }}>no change</span>}
                </label>
                <div className="sbp-gen-cols">
                  <div>
                    <div className="sbp-caption">In BC now</div>
                    {current === undefined ? <div className="sbp-muted">Loading…</div> : <DescriptionText text={now} />}
                  </div>
                  <div>
                    <div className="sbp-caption">From this spec</div>
                    <DescriptionText text={next[w]} />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="sbp-muted" style={{ fontSize: 11 }}>
            “In BC now” is the copy Switchboard keeps (refreshed hourly{current?.bcModified ? `; BC last changed it ${new Date(current.bcModified).toLocaleString()}` : ""}). Only the
            ticked descriptions are written; the others stay as they are in BC.
          </div>
          {status && (
            <div className={`sbp-banner ${status.phase === "done" ? "sbp-banner--ok" : status.phase === "failed" ? "sbp-banner--error" : ""}`} style={{ marginTop: 10 }}>
              {status.text}
            </div>
          )}
          {history.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="sbp-caption">Sent from this spec</div>
              {history.map((h) => (
                <div key={h.id} className="sbp-muted" style={{ fontSize: 12 }}>
                  {new Date(h.createdAt).toLocaleString()} · {h.jobNo} · {[h.sendProduction && "Production", h.sendField && "Field"].filter(Boolean).join(" + ")} ·{" "}
                  <b>{h.status}</b>
                  {h.requestedBy ? ` · ${h.requestedBy}` : ""}
                  {h.status === "failed" && h.message ? ` — ${h.message}` : ""}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
