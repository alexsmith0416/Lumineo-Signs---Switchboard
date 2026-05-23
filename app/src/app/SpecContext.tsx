// Shared state between the Builder's left sidebar (recent specs) and the
// form pane (active spec being edited). The cascade rules and product-code
// assembly live here so every step component just calls update() and
// everything downstream stays consistent.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SignSpec } from "../domain/SignSpec";
import { emptySignSpec } from "../domain/SignSpec";
import { assembleProductCode, calculateDepartments } from "../domain/productCode";
import { isLetter, isPan } from "../domain/signTypes";
import { signSpecs } from "../data/dataverseService";

type SpecContextValue = {
  spec: SignSpec;
  recent: SignSpec[];
  loadingRecent: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  codeCopied: boolean;

  update: (patch: Partial<SignSpec>) => void;
  setSignType: (code: SignSpec["signTypeCode"]) => void;
  setOutsourced: (v: boolean) => void;
  setIllumination: (v: SignSpec["illumination"]) => void;
  setFaceType: (v: SignSpec["faceType"]) => void;
  setVinyl: (v: SignSpec["vinyl"]) => void;
  setVinylSwatch: (display: string, hex: string) => void;

  loadSpec: (s: SignSpec) => void;
  clearAll: () => void;
  saveSpec: () => Promise<void>;
  duplicateSpec: (s: SignSpec) => void;
  deleteSpec: (id: string) => Promise<void>;
  exportSpecHtml: () => void;
  copyProductCode: () => void;
};

const SpecCtx = createContext<SpecContextValue | null>(null);

// Drafts auto-persist to localStorage so a refresh doesn't blow up unsaved
// work. Cleared on Save and on Clear.
const DRAFT_KEY = "signbuilderpro.draft.v1";

function loadDraft(): SignSpec | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // The shape moves with the SignSpec type — emptySignSpec() supplies any
    // newly-added fields so old drafts merge forward cleanly.
    return { ...emptySignSpec(), ...parsed };
  } catch {
    return null;
  }
}

export function SpecProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<SignSpec>(() => loadDraft() ?? emptySignSpec());
  const [recent, setRecent] = useState<SignSpec[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SpecContextValue["saveStatus"]>("idle");
  const [codeCopied, setCodeCopied] = useState(false);

  // Keep productCode + departments live with the spec values.
  const liveSpec = useMemo<SignSpec>(() => ({
    ...spec,
    productCode: assembleProductCode(spec),
    departments: calculateDepartments(spec),
  }), [spec]);

  // Load recent on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await signSpecs.list();
      if (!cancelled) {
        setRecent(all);
        setLoadingRecent(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist the draft whenever the spec changes. Skipping when nothing has
  // been entered yet keeps the storage key off the wire for first-time users.
  useEffect(() => {
    if (!spec.signTypeCode && !spec.customerName && !spec.projectName) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(spec)); } catch { /* quota — ignore */ }
  }, [spec]);

  const update = useCallback((patch: Partial<SignSpec>) => {
    setSpec((s) => ({ ...s, ...patch }));
  }, []);

  // setSignType resets every downstream global — equivalent to the OnChange in
  // canvas. Letter types lock faces to NA, pan types lock faces to SF, EMC
  // forces internal illumination.
  const setSignType = useCallback<SpecContextValue["setSignType"]>((code) => {
    setSpec((s) => {
      const next: SignSpec = {
        ...emptySignSpec(),
        customerName: s.customerName,
        projectName: s.projectName,
        quantity: s.quantity,
        signTypeCode: code,
      };
      if (!code) return next;
      if (isLetter(code)) next.faces = "NA";
      if (isPan(code))    next.faces = "SF";
      if (code === "EM")  next.illumination = "IL";
      if (isPan(code))    next.illumination = "NI";
      return next;
    });
  }, []);

  const setOutsourced = useCallback((v: boolean) => update({ outsourced: v }), [update]);

  // Cascade reset when illumination changes — clears LED back to default,
  // drops the previously chosen vinyl color (the 3630 vs 7725 series swap).
  const setIllumination = useCallback<SpecContextValue["setIllumination"]>((v) => {
    setSpec((s) => ({
      ...s,
      illumination: v,
      ledColor: "WH",
      faceType: "",
      backerType: "",
      backerColor: "",
      finish: "",
      paintColor: "",
      vinyl: "",
      vinylColor: "",
      vinylHex: "",
    }));
  }, []);

  // Changing the face type resets the routed-copy sub-fields + vinyl downstream.
  const setFaceType = useCallback<SpecContextValue["setFaceType"]>((v) => {
    setSpec((s) => ({
      ...s,
      faceType: v,
      backerType: "",
      backerColor: "",
      vinyl: "",
      vinylColor: "",
      vinylHex: "",
    }));
  }, []);

  const setVinyl = useCallback<SpecContextValue["setVinyl"]>((v) => {
    setSpec((s) => ({
      ...s,
      vinyl: v,
      vinylColor: "",
      vinylHex: "",
      digitalRef: "",
    }));
  }, []);

  const setVinylSwatch = useCallback((display: string, hex: string) => {
    update({ vinylColor: display, vinylHex: hex });
  }, [update]);

  const loadSpec = useCallback((s: SignSpec) => {
    setSpec(s);
    setSaveStatus("idle");
  }, []);

  const clearAll = useCallback(() => {
    setSpec(emptySignSpec());
    setSaveStatus("idle");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, []);

  const saveSpec = useCallback(async () => {
    if (!liveSpec.signTypeCode) {
      setSaveStatus("error");
      return;
    }
    setSaveStatus("saving");
    try {
      const saved = await signSpecs.save(liveSpec);
      setSpec(saved);
      const all = await signSpecs.list();
      setRecent(all);
      setSaveStatus("saved");
      // Once persisted to Dataverse / the repo, the unsaved-draft key is no
      // longer the source of truth — drop it and revert the button label to
      // "Save Spec" after 2s.
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      window.setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [liveSpec]);

  // Duplicate creates a fresh, unsaved spec preloaded with the source's
  // cascade so the user can re-customise a similar build without retyping.
  const duplicateSpec = useCallback((s: SignSpec) => {
    setSpec({
      ...s,
      id: undefined,
      status: "Draft",
      // Project / customer typically belong to the original quote; clear so
      // the duplicate is obviously a separate record.
      customerName: "",
      projectName: "",
    });
    setSaveStatus("idle");
  }, []);

  const deleteSpec = useCallback(async (id: string) => {
    await signSpecs.remove(id);
    const all = await signSpecs.list();
    setRecent(all);
    // If the currently-loaded spec is the one being deleted, snap the form
    // back to a blank slate so the user isn't editing a ghost record.
    setSpec((cur) => (cur.id === id ? emptySignSpec() : cur));
  }, []);

  const copyProductCode = useCallback(() => {
    if (!liveSpec.productCode) return;
    try {
      navigator.clipboard?.writeText(liveSpec.productCode);
    } catch { /* fall through — confirmation still fires for visual feedback */ }
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 2000);
  }, [liveSpec.productCode]);

  const exportSpecHtml = useCallback(() => {
    const lines = [
      ["SPEC CODE",   liveSpec.productCode || "—"],
      ["CUSTOMER",    liveSpec.customerName || "—"],
      ["PROJECT",     liveSpec.projectName || "—"],
      ["DATE",        new Date().toLocaleDateString()],
      ["QUANTITY",    String(liveSpec.quantity)],
      ["SIGN TYPE",   liveSpec.signTypeCode || "—"],
      ["FACES",       liveSpec.faces || "—"],
      ["DIMENSIONS",  [liveSpec.heightIn, liveSpec.widthIn, liveSpec.depthIn].filter(Boolean).join(" × ") || "—"],
      ["ILLUMINATION", liveSpec.illumination || "—"],
      ["LED COLOR",   (liveSpec.illumination === "IL" || liveSpec.illumination === "EL") ? liveSpec.ledColor : "—"],
      ["FACE TYPE",   liveSpec.faceType || "—"],
      ["FINISH",      liveSpec.finish || "—"],
      ["PAINT COLOR", liveSpec.paintColor || "—"],
      ["VINYL",       liveSpec.vinyl || "—"],
      ["VINYL COLOR", liveSpec.vinylColor || "—"],
      ["MOUNTING",    liveSpec.mounting || "—"],
      // Pole / footing / electrical only printed for ground-mount cabinets.
      ["POLE",        liveSpec.poleType || "—"],
      ["POLE SPEC",   [liveSpec.poleDiameter, liveSpec.poleMaterial].filter(Boolean).join(" · ") || "—"],
      ["FOOTING",     liveSpec.footingType || "—"],
      ["FOOTING SPEC", [liveSpec.footingDepth ? `${liveSpec.footingDepth}in` : "", liveSpec.footingMethod].filter(Boolean).join(" · ") || "—"],
      ["ELECTRICAL",  liveSpec.electrical || "—"],
      ["ELECTRICAL SPEC", [liveSpec.conduitSize, liveSpec.panelLocation].filter(Boolean).join(" · ") || "—"],
      ["DEPARTMENTS", liveSpec.departments || "—"],
      ["NOTES",       liveSpec.notes || "—"],
    ];
    const rows = lines.map(([k, v]) =>
      `<tr><th>${k}</th><td>${escapeHtml(String(v))}</td></tr>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(liveSpec.productCode || "Sign Spec")} — Lumineo</title>
      <style>
        body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a2e; max-width: 820px; margin: 32px auto; padding: 0 28px; }
        h1 { color: #141464; font-size: 22px; letter-spacing: 0.5px; margin: 0 0 4px; }
        .sub { color: #8b91a3; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; font-variant-numeric: tabular-nums; }
        th, td { padding: 10px 12px; border-bottom: 1px solid #dde0e8; text-align: left; vertical-align: top; }
        th { width: 32%; color: #8b91a3; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }
        td { font-size: 14px; }
        .code { font-family: ui-monospace, Menlo, monospace; font-weight: 700; color: #141464; background: #e8eaf5; padding: 4px 8px; border-radius: 6px; display: inline-block; }
        @media print { body { margin: 0; padding: 16px; } }
      </style></head><body>
      <div class="sub">Lumineo Signs — Sign Specification</div>
      <h1>${escapeHtml(liveSpec.projectName || "Untitled spec")}</h1>
      <div><span class="code">${escapeHtml(liveSpec.productCode || "(no code)")}</span></div>
      <table>${rows}</table>
      <script>window.onload=()=>window.print();</script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }, [liveSpec]);

  const value: SpecContextValue = {
    spec: liveSpec,
    recent,
    loadingRecent,
    saveStatus,
    codeCopied,
    update,
    setSignType,
    setOutsourced,
    setIllumination,
    setFaceType,
    setVinyl,
    setVinylSwatch,
    loadSpec,
    clearAll,
    saveSpec,
    duplicateSpec,
    deleteSpec,
    exportSpecHtml,
    copyProductCode,
  };

  return <SpecCtx.Provider value={value}>{children}</SpecCtx.Provider>;
}

export function useSpec(): SpecContextValue {
  const v = useContext(SpecCtx);
  if (!v) throw new Error("useSpec must be used inside <SpecProvider>");
  return v;
}

// Avoids importing a full HTML-escape lib for the one-line printout.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
