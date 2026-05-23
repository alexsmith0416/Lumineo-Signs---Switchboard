// Sign-type catalog and grouping helpers used by the form cascade.
// Codes are the 2-letter identifiers that appear in the assembled product code.
export const SIGN_TYPES = [
    { code: "WC", name: "Wall Sign", category: "cabinet" },
    { code: "MN", name: "Monument Sign", category: "cabinet" },
    { code: "PS", name: "Pole Sign", category: "cabinet" },
    { code: "PP", name: "Post & Panel", category: "cabinet" },
    { code: "AP", name: "Pan Sign", category: "pan" },
    { code: "EP", name: "Economy Pan Sign", category: "pan" },
    { code: "FL", name: "Channel Letters", category: "letter" },
    { code: "HL", name: "Halo Letters", category: "letter" },
    { code: "CL", name: "Combo Letters", category: "letter" },
    { code: "AL", name: "FCO Aluminum Letters", category: "letter" },
    { code: "CA", name: "Cast Aluminum Letters", category: "letter" },
    { code: "PL", name: "Formed Plastic Letters", category: "letter" },
    { code: "AC", name: "FCO Acrylic Letters", category: "letter" },
    { code: "EM", name: "Electronic Message Center", category: "emc" },
];
export const LETTER_TYPES = ["FL", "HL", "CL", "AL", "CA", "PL", "AC"];
export const PAN_TYPES = ["AP", "EP"];
export const CABINET_TYPES = ["WC", "MN", "PS", "PP"];
export const INDOOR_ONLY = ["AC", "CA"]; // surface a red banner
export const POLE_FOOTING_TYPES = ["MN", "PS", "PP"]; // steps 10/11/12 gate
export function getSignType(code) {
    return SIGN_TYPES.find((t) => t.code === code);
}
export function isLetter(code) {
    return LETTER_TYPES.includes(code);
}
export function isPan(code) {
    return PAN_TYPES.includes(code);
}
export function isCabinet(code) {
    return CABINET_TYPES.includes(code);
}
