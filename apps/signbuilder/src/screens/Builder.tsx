import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailLevel, SignLine, Spec } from "../domain/types";
import { evaluate } from "../engine/flow";
import { buildFromTemplates, buildProduction } from "../engine/descriptions";
import type { SetupIndex } from "../engine/setup-index";
import type { CurrentUser } from "../services/current-user";
import { useSetupStore } from "../store/setup-store";
import { useSpecStore } from "../store/spec-store";
import ConfirmDialog from "../components/ConfirmDialog";
import { Progress, StatusPill, formatDate } from "../components/ui";
import { printHtml } from "../services/print";
import QuestionCard from "./builder/QuestionCard";
import ReferencePanel from "./builder/ReferencePanel";
import { JobPicker, OpportunityPicker } from "./builder/BcPickers";
import GenerateToProject from "./builder/GenerateToProject";
import DesignFilesPicker, { designRefText } from "./builder/DesignFilesPicker";
import { spUrlOf } from "../services/sharepoint";
import { jobFields, opportunityFields } from "../services/bc-fill";
import DescriptionPreview from "./builder/DescriptionPreview";

interface Props {
  user: CurrentUser;
  specId: string;
  onSelectSpec: (id: string) => void;
  selectedSignId: string;
  onSelectSign: (id: string) => void;
}

export default function Builder({ user, specId, onSelectSpec, selectedSignId, onSelectSign }: Props) {
  const specs = useSpecStore((s) => s.specs);
  const lines = useSpecStore((s) => s.lines);
  const idx = useSetupStore((s) => s.idx);
  const createSpec = useSpecStore((s) => s.createSpec);
  const spec = specs.find((s) => s.id === specId);

  return (
    <div className="sbp-page">
      <div className="sbp-builder">
        <RecentSpecs specs={specs} lines={lines} currentId={specId} onSelect={onSelectSpec} onNew={user.permissions.editSpecs ? () => onSelectSpec(createSpec({}, user.fullName).id) : undefined} />
        {!spec || !idx ? (
          <div className="sbp-card">
            <div className="sbp-caption">Builder</div>
            <p className="sbp-muted">Pick a spec on the left{user.permissions.editSpecs ? ", or start a new one" : ""}.</p>
          </div>
        ) : (
          <SpecWorkspace key={spec.id} idx={idx} spec={spec} user={user} selectedSignId={selectedSignId} onSelectSign={onSelectSign} />
        )}
      </div>
    </div>
  );
}

function RecentSpecs({ specs, lines, currentId, onSelect, onNew }: { specs: Spec[]; lines: SignLine[]; currentId: string; onSelect: (id: string) => void; onNew?: () => void }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...specs]
      .sort((a, b) => (b.modifiedAt || "").localeCompare(a.modifiedAt || ""))
      .filter((s) => !q || [s.number, s.customerName, s.description, s.jobNo, s.opportunityNo].join(" ").toLowerCase().includes(q));
  }, [specs, search]);
  return (
    <div className="sbp-card sbp-recent sbp-no-print">
      <div className="sbp-row" style={{ marginBottom: 8 }}>
        <div className="sbp-caption">Recent Specs</div>
        <div className="sbp-spacer" />
        {onNew && (
          <button type="button" className="btn-primary" onClick={onNew}>
            + New
          </button>
        )}
      </div>
      <input className="sbp-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      {shown.map((s) => (
        <div key={s.id} className={`sbp-recent__item${s.id === currentId ? " sbp-recent__item--active" : ""}`} onClick={() => onSelect(s.id)}>
          <div className="sbp-recent__title">
            {s.number} · {s.customerName || s.description || "New spec"}
          </div>
          <div className="sbp-recent__sub">
            {[s.jobNo && `Job ${s.jobNo}`, s.opportunityNo && `Opp ${s.opportunityNo}`, `${lines.filter((l) => l.specId === s.id).length} signs`].filter(Boolean).join(" · ")}
          </div>
        </div>
      ))}
      {shown.length === 0 && <div className="sbp-muted">No specs.</div>}
    </div>
  );
}

function SpecWorkspace({ idx, spec, user, selectedSignId, onSelectSign }: { idx: SetupIndex; spec: Spec; user: CurrentUser; selectedSignId: string; onSelectSign: (id: string) => void }) {
  const allLines = useSpecStore((s) => s.lines);
  const projects = useSpecStore((s) => s.projects);
  const updateSpec = useSpecStore((s) => s.updateSpec);
  const deleteSpec = useSpecStore((s) => s.deleteSpec);
  const setDetailLevel = useSpecStore((s) => s.setDetailLevel);
  const addSign = useSpecStore((s) => s.addSign);
  const lines = useMemo(() => allLines.filter((l) => l.specId === spec.id).sort((a, b) => a.lineNo - b.lineNo), [allLines, spec.id]);
  const readOnly = !user.permissions.editSpecs;
  const [preview, setPreview] = useState(false);
  const [picking, setPicking] = useState<"opportunity" | "job" | "design" | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keep a sign selected.
  useEffect(() => {
    if (!lines.some((l) => l.id === selectedSignId)) onSelectSign(lines[0]?.id ?? "");
  }, [lines, selectedSignId, onSelectSign]);
  const selected = lines.find((l) => l.id === selectedSignId);

  const summary = useMemo(() => {
    let total = 0;
    let answered = 0;
    let surveys = 0;
    for (const l of lines) {
      const ev = evaluate(idx, l, spec.detailLevel);
      total += ev.requiredTotal;
      answered += ev.requiredAnswered;
      surveys += ev.openSurveys;
    }
    return { pct: lines.length === 0 ? 0 : total === 0 ? 100 : (answered / total) * 100, surveys };
  }, [idx, lines, spec.detailLevel]);

  const field = (label: string, key: keyof Spec, width?: number) => (
    <div className="sbp-field" style={width ? { minWidth: width } : undefined}>
      <label>{label}</label>
      <input className="sbp-input" value={String(spec[key] ?? "")} disabled={readOnly} onChange={(e) => updateSpec(spec.id, { [key]: e.target.value } as Partial<Spec>)} />
    </div>
  );

  // A spec field with a "pick from BC" button.
  const pickField = (label: string, key: "opportunityNo" | "jobNo", onPick: () => void) => (
    <div className="sbp-field">
      <label>{label}</label>
      <div className="sbp-row" style={{ gap: 4 }}>
        <input className="sbp-input" style={{ flex: 1, minWidth: 0 }} value={spec[key]} disabled={readOnly} onChange={(e) => updateSpec(spec.id, { [key]: e.target.value } as Partial<Spec>)} />
        {!readOnly && (
          <button type="button" className="btn-secondary" title={`Pick from Business Central`} onClick={onPick}>
            Pick…
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div style={{ minWidth: 0 }}>
        {/* Spec header */}
        <div className="sbp-card" data-tour="spec-header">
          <div className="sbp-row" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{spec.number}</div>
            <StatusPill status={spec.status} />
            {spec.jobNo && <span className="sbp-pill">Job {spec.jobNo}</span>}
            {spec.opportunityNo && <span className="sbp-pill">Opp {spec.opportunityNo}</span>}
            <div className="sbp-spacer" />
            <Progress pct={summary.pct} />
            {summary.surveys > 0 && <span className="sbp-pill sbp-pill--warn">{summary.surveys} open survey{summary.surveys === 1 ? "" : "s"}</span>}
          </div>
          <div className="sbp-grid-fields">
            {field("Description", "description")}
            {field("Customer", "customerName")}
            {field("Contact", "contactName")}
            {pickField("Opportunity No.", "opportunityNo", () => setPicking("opportunity"))}
            {pickField("Job No.", "jobNo", () => setPicking("job"))}
            <div className="sbp-field" data-tour="design-reference">
              <label>Design Reference</label>
              <div className="sbp-row" style={{ gap: 4 }}>
                <input className="sbp-input" style={{ flex: 1, minWidth: 0 }} value={spec.designReference} disabled={readOnly} onChange={(e) => updateSpec(spec.id, { designReference: e.target.value })} />
                {!readOnly && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!spec.jobNo}
                    title={spec.jobNo ? "Pick the reference file(s) from the job's SharePoint folder" : "Fill in the Job No. first — the files come from the job's SharePoint folder"}
                    onClick={() => setPicking("design")}
                  >
                    Browse…
                  </button>
                )}
              </div>
              {(spec.designFiles?.length ?? 0) > 0 && (
                <div className="sbp-design-files">
                  {spec.designFiles!.map((f) => (
                    <a key={f.ref} className="sbp-pill" href={spUrlOf(f.ref)} target="_blank" rel="noreferrer" title={`Open ${f.name} in SharePoint`}>
                      {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="sbp-field">
              <label>Project</label>
              <select className="sbp-select" value={spec.projectId} disabled={readOnly} onChange={(e) => updateSpec(spec.id, { projectId: e.target.value })}>
                <option value="">—</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sbp-row" style={{ marginTop: 12 }}>
            <DetailToggle value={spec.detailLevel} disabled={readOnly} onChange={(v) => setDetailLevel(spec.id, v)} />
            <div className="sbp-spacer" />
            <button type="button" className="btn-secondary" data-tour="preview-descriptions" onClick={() => setPreview(true)}>
              Preview Descriptions
            </button>
            <button type="button" className="btn-secondary" onClick={() => printSpec(idx, spec, lines)}>
              Print Spec
            </button>
            {user.permissions.generateToProject && (
              <button type="button" className="btn-secondary" data-tour="generate-to-project" title="Write the descriptions to the BC project" onClick={() => setGenerating(true)}>
                Generate to Project…
              </button>
            )}
            {!readOnly && spec.status === "draft" && (
              <button type="button" className="btn-secondary" onClick={() => updateSpec(spec.id, { status: "submitted" })}>
                Submit
              </button>
            )}
            {user.permissions.approve && spec.status === "submitted" && (
              <button type="button" className="btn-primary" onClick={() => updateSpec(spec.id, { status: "approved", approvedBy: user.fullName, approvedAt: new Date().toISOString() })}>
                Approve
              </button>
            )}
            {user.permissions.approve && spec.status === "approved" && (
              <button type="button" className="btn-secondary" onClick={() => updateSpec(spec.id, { status: "built" })}>
                Mark Built
              </button>
            )}
            {!readOnly && (
              <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )}
          </div>
          {(spec.approvedBy || spec.lastGeneratedAt) && (
            <div className="sbp-muted" style={{ fontSize: 12, marginTop: 6 }}>
              {spec.approvedBy && <>Approved by {spec.approvedBy} {formatDate(spec.approvedAt)}. </>}
              {spec.lastGeneratedAt && <>Descriptions last sent to BC {new Date(spec.lastGeneratedAt).toLocaleString()}.</>}
            </div>
          )}
        </div>

        {/* Signs */}
        <div className="sbp-card" data-tour="signs">
          <div className="sbp-caption" style={{ marginBottom: 8 }}>
            Signs
          </div>
          <div className="sbp-signs">
            {lines.map((l, i) => (
              <SignCard key={l.id} idx={idx} line={l} n={i + 1} active={l.id === selectedSignId} onClick={() => onSelectSign(l.id)} />
            ))}
            {!readOnly && <AddSign idx={idx} onAdd={(cat) => { const l = addSign(spec.id, cat); if (l) onSelectSign(l.id); }} />}
          </div>
        </div>

        {/* Questions of the selected sign */}
        {selected && <SignForm key={selected.id} idx={idx} spec={spec} line={selected} readOnly={readOnly} />}

        <div className="sbp-card">
          <div className="sbp-caption" style={{ marginBottom: 6 }}>
            Job Detail Notes
          </div>
          <textarea
            className="sbp-textarea"
            style={{ width: "100%", minHeight: 110 }}
            value={spec.jobDetailNotes}
            disabled={readOnly}
            placeholder="Notes for the whole job — printed at the end of the Production Description under JOB DETAIL NOTES."
            onChange={(e) => updateSpec(spec.id, { jobDetailNotes: e.target.value })}
          />
        </div>
      </div>

      <div className="sbp-builder__aside sbp-no-print" data-tour="reference-panel">
        <ReferencePanel code={selected?.specReferenceCode ?? ""} />
        {selected && <SignSummary idx={idx} spec={spec} line={selected} />}
      </div>

      {preview && <DescriptionPreview spec={spec} lines={lines} onClose={() => setPreview(false)} />}
      {generating && (
        <GenerateToProject
          spec={spec}
          lines={lines}
          userName={user.fullName || user.email}
          onSent={() => updateSpec(spec.id, { lastGeneratedAt: new Date().toISOString() })}
          onPickJob={() => setPicking("job")}
          onClose={() => setGenerating(false)}
        />
      )}
      {picking === "opportunity" && (
        <OpportunityPicker
          userName={user.fullName || user.email}
          onClose={() => setPicking(null)}
          onPick={(o) => {
            updateSpec(spec.id, opportunityFields(spec, o));
            setPicking(null);
          }}
        />
      )}
      {picking === "design" && (
        <DesignFilesPicker
          jobNo={spec.jobNo}
          initial={spec.designFiles ?? []}
          onClose={() => setPicking(null)}
          onPick={(files) => {
            // Design Reference follows the picked files unless someone typed their own.
            const auto = !spec.designReference || spec.designReference === designRefText(spec.designFiles ?? []);
            updateSpec(spec.id, { designFiles: files, ...(auto ? { designReference: designRefText(files) } : {}) });
            setPicking(null);
          }}
        />
      )}
      {picking === "job" && (
        <JobPicker
          userName={user.fullName || user.email}
          onClose={() => setPicking(null)}
          onPick={(j) => {
            updateSpec(spec.id, jobFields(spec, j));
            setPicking(null);
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${spec.number}?`}
          message="The spec and all its signs are removed."
          danger
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteSpec(spec.id);
          }}
        />
      )}
    </>
  );
}

function DetailToggle({ value, disabled, onChange }: { value: DetailLevel; disabled: boolean; onChange: (v: DetailLevel) => void }) {
  return (
    <div className="sbp-choices" data-tour="detail-toggle" title="Opportunity = only the core questions. Job details = every question, as needed before the order is released.">
      <button type="button" disabled={disabled} className={`sbp-choice${value === "opportunity" ? " sbp-choice--on" : ""}`} onClick={() => onChange("opportunity")}>
        Opportunity details
      </button>
      <button type="button" disabled={disabled} className={`sbp-choice${value === "full" ? " sbp-choice--on" : ""}`} onClick={() => onChange("full")}>
        Job details
      </button>
    </div>
  );
}

function SignCard({ idx, line, n, active, onClick }: { idx: SetupIndex; line: SignLine; n: number; active: boolean; onClick: () => void }) {
  const type = line.typeDecided ? idx.signType(line.signTypeCode)?.description : "";
  return (
    <div className={`sbp-sign${active ? " sbp-sign--active" : ""}`} onClick={onClick}>
      <div className="sbp-row">
        <span className="sbp-sign__name">{line.signName || `Sign ${n}`}</span>
        <div className="sbp-spacer" />
        <span className="sbp-pill">×{line.quantity}</span>
      </div>
      <div className="sbp-sign__type">{type || idx.category(line.categoryCode)?.description || ""}</div>
      <div className="sbp-row" style={{ marginTop: 6 }}>
        <Progress pct={line.completedPct} />
      </div>
      {line.specCode && (
        <div style={{ marginTop: 6 }}>
          <span className="sbp-code">{line.specCode}</span>
        </div>
      )}
    </div>
  );
}

function AddSign({ idx, onAdd }: { idx: SetupIndex; onAdd: (categoryCode: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="sbp-sign sbp-sign--add" onClick={() => setOpen(true)}>
        + Add sign
      </div>
    );
  }
  return (
    <div className="sbp-sign" style={{ cursor: "default" }}>
      <div className="sbp-caption" style={{ marginBottom: 6 }}>
        Category
      </div>
      <div className="sbp-choices">
        {idx.activeCategories().map((c) => (
          <button key={c.code} type="button" className="sbp-choice" onClick={() => { setOpen(false); onAdd(c.code); }}>
            {c.description}
          </button>
        ))}
        <button type="button" className="sbp-choice sbp-choice--special" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** The selected sign: name, qty and its questions as step cards. */
function SignForm({ idx, spec, line, readOnly }: { idx: SetupIndex; spec: Spec; line: SignLine; readOnly: boolean }) {
  const answer = useSpecStore((s) => s.answer);
  const updateSign = useSpecStore((s) => s.updateSign);
  const setQty = useSpecStore((s) => s.setSignQuantity);
  const deleteSign = useSpecStore((s) => s.deleteSign);
  const copySign = useSpecStore((s) => s.copySign);
  const refreshSign = useSpecStore((s) => s.refreshSign);
  const ev = useMemo(() => evaluate(idx, line, spec.detailLevel), [idx, line, spec.detailLevel]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ kind: "info" | "warn"; text: string } | null>(null);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [hideAnswered, setHideAnswered] = useState(false);
  const scrollTo = useRef<string>("");

  const questions = idx.questions(line.signTypeCode).filter((q) => ev.states[q.code]?.visible);
  const shown = hideAnswered ? questions.filter((q) => ev.states[q.code]?.value === "" || ev.states[q.code]?.nextStep) : questions;

  // After an answer: scroll the next question into view (a web page can).
  useEffect(() => {
    if (!scrollTo.current) return;
    const el = document.getElementById(`q-${scrollTo.current}`);
    scrollTo.current = "";
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const onAnswer = (code: string, input: string, sizes?: number[]) => {
    const before = new Set(questions.map((q) => q.code));
    const res = answer(line.id, code, input, sizes);
    if (res.error) {
      setErrors({ ...errors, [code]: res.error });
      return;
    }
    setErrors({ ...errors, [code]: "" });
    const msgs: string[] = [];
    if (res.cleared.length) msgs.push(`Cleared because they no longer apply: ${res.cleared.map((c) => `${c.prompt} (was ${c.value})`).join("; ")}`);
    if (res.message) msgs.push(res.message);
    setNotice(msgs.length ? { kind: res.message ? "warn" : "info", text: msgs.join(" ") } : null);
    // What appeared, and where to go next.
    const after = useSpecStore.getState().lines.find((l) => l.id === line.id);
    if (after) {
      const ev2 = evaluate(idx, after, spec.detailLevel);
      const nowVisible = idx.questions(after.signTypeCode).filter((q) => ev2.states[q.code]?.visible);
      setNewCodes(nowVisible.filter((q) => !before.has(q.code)).map((q) => q.code));
      scrollTo.current = nowVisible.find((q) => ev2.states[q.code]?.nextStep)?.code ?? "";
    }
  };

  let lastSection = "";
  let n = 0;
  return (
    <div className="sbp-card">
      <div className="sbp-row" style={{ marginBottom: 6 }}>
        <div className="sbp-field" style={{ flex: 1 }}>
          <label>Sign name</label>
          <input className="sbp-input" value={line.signName} disabled={readOnly} placeholder="e.g. Main ID – North elevation" onChange={(e) => updateSign({ ...line, signName: e.target.value }, "Rename sign")} />
        </div>
        <div className="sbp-field" style={{ minWidth: 90, maxWidth: 110 }}>
          <label>Qty</label>
          <input
            className="sbp-input"
            type="number"
            min={1}
            value={line.quantity}
            disabled={readOnly}
            onChange={(e) => {
              const err = setQty(line.id, parseInt(e.target.value, 10) || 0);
              if (err) setNotice({ kind: "warn", text: err });
            }}
          />
        </div>
      </div>
      <div className="sbp-row sbp-no-print" style={{ marginBottom: 6 }}>
        <span className="sbp-muted" style={{ fontSize: 12 }}>
          {idx.category(line.categoryCode)?.description}
          {line.typeDecided ? ` · ${idx.signType(line.signTypeCode)?.description}` : " · answer the first questions to pick the type"}
        </span>
        <div className="sbp-spacer" />
        <label className="sbp-muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={hideAnswered} onChange={(e) => setHideAnswered(e.target.checked)} /> Only open questions
        </label>
        {!readOnly && (
          <>
            <button type="button" className="btn-secondary" onClick={() => copySign(line.id)}>
              Copy Sign
            </button>
            <button type="button" className="btn-secondary" title="Bring this sign in line with the current setup" onClick={() => refreshSign(line.id)}>
              Refresh
            </button>
            <button type="button" className="btn-danger" onClick={() => deleteSign(line.id)}>
              Delete Sign
            </button>
          </>
        )}
      </div>
      {notice && <div className={`sbp-banner${notice.kind === "warn" ? " sbp-banner--warn" : ""}`}>{notice.text}</div>}
      {shown.map((q) => {
        n++;
        const section = idx.sections.find((s) => s.code === q.sectionCode)?.heading ?? q.sectionCode;
        const heading = section !== lastSection ? section : "";
        lastSection = section;
        return (
          <div key={q.code}>
            {heading && <div className="sbp-section-heading">{heading}</div>}
            <QuestionCard
              idx={idx}
              number={n}
              question={q}
              state={ev.states[q.code]!}
              isNew={newCodes.includes(q.code)}
              readOnly={readOnly}
              error={errors[q.code] ?? ""}
              onAnswer={(input, sizes) => onAnswer(q.code, input, sizes)}
            />
          </div>
        );
      })}
      {questions.length > 0 && !questions.some((q) => ev.states[q.code]?.nextStep) && (
        <div className="sbp-banner sbp-banner--ok">Every required question for this sign is answered{spec.detailLevel === "opportunity" ? " at the opportunity level" : ""}.</div>
      )}
    </div>
  );
}

function SignSummary({ idx, spec, line }: { idx: SetupIndex; spec: Spec; line: SignLine }) {
  const ev = useMemo(() => evaluate(idx, line, spec.detailLevel), [idx, line, spec.detailLevel]);
  return (
    <div className="sbp-card">
      <div className="sbp-caption">This sign</div>
      <div style={{ margin: "6px 0" }}>
        <Progress pct={line.completedPct} />
      </div>
      <div style={{ fontSize: 12 }} className="sbp-muted">
        {ev.missingRequired > 0 ? `${ev.missingRequired} required question${ev.missingRequired === 1 ? "" : "s"} left` : "All required questions answered"}
        {ev.openSurveys > 0 ? ` · ${ev.openSurveys} open survey${ev.openSurveys === 1 ? "" : "s"}` : ""}
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="sbp-caption">Spec Code</span>
        <div style={{ marginTop: 4 }}>
          <span className="sbp-code">{line.specCode || "—"}</span>
        </div>
      </div>
    </div>
  );
}

/** A printable spec sheet: header, each sign's answers, and the descriptions. */
function printSpec(idx: SetupIndex, spec: Spec, lines: SignLine[]): void {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let body = `<h1>${esc(spec.number)} — ${esc(spec.customerName || spec.description)}</h1>`;
  body += `<p>${[spec.opportunityNo && `Opportunity ${spec.opportunityNo}`, spec.jobNo && `Job ${spec.jobNo}`, spec.designReference && `Design ${spec.designReference}`].filter(Boolean).map(esc).join(" · ")}</p>`;
  lines.forEach((l, i) => {
    const ev = evaluate(idx, l, spec.detailLevel);
    body += `<h2>Sign ${i + 1}: ${esc(l.signName || idx.signType(l.signTypeCode)?.description || "")} ×${l.quantity} <code>${esc(l.specCode)}</code></h2><table>`;
    for (const q of idx.questions(l.signTypeCode)) {
      const st = ev.states[q.code];
      if (!st?.eligible || !st.value) continue;
      body += `<tr><th>${esc(q.prompt)}</th><td>${esc(st.value)}</td></tr>`;
    }
    body += "</table>";
  });
  body += `<h2>Production Description</h2><pre>${esc(buildProduction(idx, spec, lines))}</pre>`;
  body += `<h2>Field Description</h2><pre>${esc(buildFromTemplates(idx, spec, lines, "field"))}</pre>`;
  printHtml(
    `<!DOCTYPE html><html><head><title>${esc(spec.number)}</title><style>body{font-family:"Open Sans",Arial,sans-serif;font-size:12px;margin:24px;color:#1f1f2e}h1{color:#141464;font-size:20px}h2{font-size:14px;margin-top:20px;border-bottom:2px solid #141464}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #e4e5ea;vertical-align:top}th{width:40%;color:#4a4f5e}pre{white-space:pre-wrap;font-family:inherit}code{background:#e8eaf5;padding:1px 6px;border-radius:4px}</style></head><body>${body}</body></html>`,
  );
}
