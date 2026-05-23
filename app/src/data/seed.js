// Seed a handful of sample specs the first time the app runs in dev so the
// Dashboard and Builder sidebar show realistic content instead of empty
// states. No-op once the user has saved anything.
import { emptySignSpec } from "../domain/SignSpec";
import { localSignSpecRepo } from "./dataverseService";
const SEED = [
    {
        ...emptySignSpec(),
        id: "seed-wc-1",
        productCode: "WC-DF-IL-RFPB-P-CV-WB-WH",
        customerName: "Westview Medical",
        projectName: "Main Entry Cabinet",
        quantity: 2,
        signTypeCode: "WC",
        faces: "DF",
        illumination: "IL",
        ledColor: "WH",
        faceType: "RFPB",
        finish: "P",
        paintColor: "PMS 286 C Navy",
        vinyl: "CV",
        vinylColor: "3M 3630 — 010 White",
        vinylHex: "#F5F5F5",
        mounting: "WB",
        heightIn: "36",
        widthIn: "120",
        depthIn: "6",
        status: "Approved",
        departments: "Metal Fabrication, Paint, Vinyl, Assembly",
    },
    {
        ...emptySignSpec(),
        id: "seed-mn-1",
        productCode: "MN-SF-EL-AT-P-CV-FM-WH",
        customerName: "Lakeside Office Park",
        projectName: "Monument — North Entrance",
        quantity: 1,
        signTypeCode: "MN",
        faces: "SF",
        illumination: "EL",
        ledColor: "WH",
        faceType: "AT",
        finish: "P",
        paintColor: "PMS 7546 C",
        vinyl: "CV",
        vinylColor: "3M 3630 — 022 Black",
        vinylHex: "#1A1A1A",
        mounting: "FM",
        heightIn: "72",
        widthIn: "96",
        depthIn: "12",
        status: "Submitted",
        departments: "Grounding, Metal Fabrication, Paint, Vinyl, Assembly",
    },
    {
        ...emptySignSpec(),
        id: "seed-fl-1",
        productCode: "FL-NI-PT-OEM-NV-DM",
        customerName: "Pioneer Bank",
        projectName: "Storefront Channel Letters",
        quantity: 8,
        signTypeCode: "FL",
        faces: "NA",
        illumination: "IL",
        ledColor: "WH",
        faceType: "PT",
        outsourced: true,
        finish: "OEM",
        vinyl: "NV",
        mounting: "DM",
        status: "Draft",
        departments: "Assembly",
    },
];
export async function seedIfEmpty() {
    const existing = await localSignSpecRepo.list();
    if (existing.length > 0)
        return;
    for (const s of SEED)
        await localSignSpecRepo.save(s);
}
