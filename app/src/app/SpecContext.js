import { jsx as _jsx } from "react/jsx-runtime";
// Shared state between the Builder's left sidebar (recent specs) and the
// form pane (active spec being edited). The cascade rules and product-code
// assembly live here so every step component just calls update() and
// everything downstream stays consistent.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { emptySignSpec } from "../domain/SignSpec";
import { assembleProductCode, calculateDepartments } from "../domain/productCode";
import { isLetter, isPan } from "../domain/signTypes";
import { signSpecs } from "../data/dataverseService";
const SpecCtx = createContext(null);
export function SpecProvider({ children }) {
    const [spec, setSpec] = useState(() => emptySignSpec());
    const [recent, setRecent] = useState([]);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [saveStatus, setSaveStatus] = useState("idle");
    const [codeCopied, setCodeCopied] = useState(false);
    // Keep productCode + departments live with the spec values.
    const liveSpec = useMemo(() => ({
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
    const update = useCallback((patch) => {
        setSpec((s) => ({ ...s, ...patch }));
    }, []);
    // setSignType resets every downstream global — equivalent to the OnChange in
    // canvas. Letter types lock faces to NA, pan types lock faces to SF, EMC
    // forces internal illumination.
    const setSignType = useCallback((code) => {
        setSpec((s) => {
            const next = {
                ...emptySignSpec(),
                customerName: s.customerName,
                projectName: s.projectName,
                quantity: s.quantity,
                signTypeCode: code,
            };
            if (!code)
                return next;
            if (isLetter(code))
                next.faces = "NA";
            if (isPan(code))
                next.faces = "SF";
            if (code === "EM")
                next.illumination = "IL";
            if (isPan(code))
                next.illumination = "NI";
            return next;
        });
    }, []);
    const setOutsourced = useCallback((v) => update({ outsourced: v }), [update]);
    // Cascade reset when illumination changes — clears LED back to default,
    // drops the previously chosen vinyl color (the 3630 vs 7725 series swap).
    const setIllumination = useCallback((v) => {
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
    const setFaceType = useCallback((v) => {
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
    const setVinyl = useCallback((v) => {
        setSpec((s) => ({
            ...s,
            vinyl: v,
            vinylColor: "",
            vinylHex: "",
            digitalRef: "",
        }));
    }, []);
    const setVinylSwatch = useCallback((display, hex) => {
        update({ vinylColor: display, vinylHex: hex });
    }, [update]);
    const loadSpec = useCallback((s) => {
        setSpec(s);
        setSaveStatus("idle");
    }, []);
    const clearAll = useCallback(() => {
        setSpec(emptySignSpec());
        setSaveStatus("idle");
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
        }
        catch {
            setSaveStatus("error");
        }
    }, [liveSpec]);
    const copyProductCode = useCallback(() => {
        if (!liveSpec.productCode)
            return;
        try {
            navigator.clipboard?.writeText(liveSpec.productCode);
        }
        catch { /* fall through — confirmation still fires for visual feedback */ }
        setCodeCopied(true);
        window.setTimeout(() => setCodeCopied(false), 2000);
    }, [liveSpec.productCode]);
    const exportSpecHtml = useCallback(() => {
        const lines = [
            ["SPEC CODE", liveSpec.productCode || "—"],
            ["CUSTOMER", liveSpec.customerName || "—"],
            ["PROJECT", liveSpec.projectName || "—"],
            ["DATE", new Date().toLocaleDateString()],
            ["QUANTITY", String(liveSpec.quantity)],
            ["SIGN TYPE", liveSpec.signTypeCode || "—"],
            ["FACES", liveSpec.faces || "—"],
            ["DIMENSIONS", [liveSpec.heightIn, liveSpec.widthIn, liveSpec.depthIn].filter(Boolean).join(" × ") || "—"],
            ["ILLUMINATION", liveSpec.illumination || "—"],
            ["LED COLOR", (liveSpec.illumination === "IL" || liveSpec.illumination === "EL") ? liveSpec.ledColor : "—"],
            ["FACE TYPE", liveSpec.faceType || "—"],
            ["FINISH", liveSpec.finish || "—"],
            ["PAINT COLOR", liveSpec.paintColor || "—"],
            ["VINYL", liveSpec.vinyl || "—"],
            ["VINYL COLOR", liveSpec.vinylColor || "—"],
            ["MOUNTING", liveSpec.mounting || "—"],
            ["DEPARTMENTS", liveSpec.departments || "—"],
            ["NOTES", liveSpec.notes || "—"],
        ];
        const rows = lines.map(([k, v]) => `<tr><th>${k}</th><td>${escapeHtml(String(v))}</td></tr>`).join("");
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
        if (!w)
            return;
        w.document.open();
        w.document.write(html);
        w.document.close();
    }, [liveSpec]);
    const value = {
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
        exportSpecHtml,
        copyProductCode,
    };
    return _jsx(SpecCtx.Provider, { value: value, children: children });
}
export function useSpec() {
    const v = useContext(SpecCtx);
    if (!v)
        throw new Error("useSpec must be used inside <SpecProvider>");
    return v;
}
// Avoids importing a full HTML-escape lib for the one-line printout.
function escapeHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
