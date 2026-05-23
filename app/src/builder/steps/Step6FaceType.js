import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSpec } from "../../app/SpecContext";
// Face type options vary by sign type. Letters get a much shorter list.
function getOptions(signType) {
    const isLetter = ["FL", "HL", "CL", "AL", "CA", "PL", "AC"].includes(signType);
    if (isLetter) {
        return [
            { value: "AT", label: "Aluminum Trim Cap (Letter standard)" },
            { value: "PT", label: "Plex Face / Trim Cap" },
        ];
    }
    if (signType === "EM") {
        return [{ value: "EM", label: "EMC LED Panel" }];
    }
    return [
        { value: "AT", label: "Aluminum (Routed / Cabinet)" },
        { value: "PT", label: "Plex Face" },
        { value: "RFPB", label: "Routed Face — Push-Back Backer" },
        { value: "RFPT", label: "Routed Face — Push-Through" },
        { value: "DF", label: "Direct Print / Digital Face" },
    ];
}
export function Step6FaceType() {
    const { spec, setFaceType } = useSpec();
    const options = getOptions(spec.signTypeCode || "");
    return (_jsxs("div", { className: "sbp-step", children: [_jsx("div", { className: "sbp-step__head", children: _jsx("span", { children: "6 \u00B7 Face Type" }) }), _jsx("div", { className: "sbp-step__body", children: _jsxs("select", { className: "lum-select", value: spec.faceType, onChange: (e) => setFaceType((e.target.value || "")), children: [_jsx("option", { value: "", children: "Select\u2026" }), options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }) })] }));
}
