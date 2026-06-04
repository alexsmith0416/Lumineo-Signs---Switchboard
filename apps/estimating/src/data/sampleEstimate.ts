// CNB sample estimate — a completed, real job seeded so the app opens with a
// fully worked example to look over. Transcribed straight from the filled
// workbook (reference/estimating/Sign365 LN Estimate - CNB.xlsx, Job J36938),
// one piece per used worksheet, with each sheet's inventory + shop-labor
// lines carried verbatim. Every piece uses the freeform-tm type (its compute
// returns nothing) so the totals are exactly these lines and reconcile to the
// workbook's $30,030.52 — see cnb-acceptance.test.ts.

import type { Project } from '../lib/engine';

export const CNB_SAMPLE_ESTIMATE: Project = {
  id: "cnb-J36938",
  jobNumber: "J36938",
  jobName: "Community National Bank and Trust",
  estimator: "DD",
  description:
    "D/F I/I Routed push thru w/Logo cabinets, EMC frame, pole cover, reveal",
  pieces: [
    {
      id: "cnb-p1",
      typeId: "freeform-tm",
      label: "Freeform time and material",
      inputs: { description: "Freeform time and material" },
      extraMaterials: [
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 10, unitCost: 0, unitPrice: 3, profitPct: 100 },
      ],
      extraLabor: [
      { workCode: 2215, description: "Assembly Labor — Mount & wire Trim cap logos", hours: 3 },
      ],
    },
    {
      id: "cnb-p2",
      typeId: "freeform-tm",
      label: "Apply Vinyl Graphics",
      inputs: { description: "Apply vinyl graphics" },
      extraMaterials: [
      { itemNo: "15456", description: "48\" 3630-20 White", units: 52, unitCost: 1.968, unitPrice: 3.543, profitPct: 44.4539 },
      ],
      extraLabor: [
      { workCode: 2416, description: "Graphics Application Labor", hours: 2.5 },
      ],
    },
    {
      id: "cnb-p3",
      typeId: "freeform-tm",
      label: "Apply Vinyl Graphics (#2)",
      inputs: { description: "Apply vinyl graphics (2)" },
      extraMaterials: [
      { itemNo: "19120", description: "48\" 3635-70 Wht Diffuser 70%", units: 52, unitCost: 1.25, unitPrice: 2.25, profitPct: 44.4444 },
      ],
      extraLabor: [
      { workCode: 2416, description: "Graphics Application Labor", hours: 1.25 },
      ],
    },
    {
      id: "cnb-p4",
      typeId: "freeform-tm",
      label: "Routed Panel Shapes Aluminum or Acrylic",
      inputs: { description: "Routed panel shapes" },
      extraMaterials: [],
      extraLabor: [
      { workCode: 2010, description: "Routing Labor — setup", hours: 1 },
      { workCode: 2010, description: "Routing Labor", hours: 0.75 },
      ],
    },
    {
      id: "cnb-p5",
      typeId: "freeform-tm",
      label: "Double face routed cabinet",
      inputs: { description: "Df routed cabinet" },
      extraMaterials: [
      { itemNo: "24065", description: "Routing - .125 Mil Alum 5052", units: 100, unitCost: 5.516, unitPrice: 9.93, profitPct: 44.4512 },
      { itemNo: "53045", description: ".500 Clear Plex", units: 112, unitCost: 8.789, unitPrice: 15.822, profitPct: 44.4508 },
      { itemNo: "24055", description: ".090 Mil Alum 3003", units: 60, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.4474 },
      { itemNo: "20050", description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 90, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.4516 },
      { itemNo: "22030", description: "ZF .188 Retainer", units: 40, unitCost: 2.557, unitPrice: 4.603, profitPct: 44.4493 },
      { itemNo: "28050", description: "2 X 2 X .187 Angle Iron", units: 10, unitCost: 1.639, unitPrice: 2.95, profitPct: 44.4407 },
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 50, unitCost: 0, unitPrice: 3, profitPct: 100 },
      { itemNo: "EST PAINT - CUSTOM", description: "Estimate for Custom Paint Color", units: 17600, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44 },
      { itemNo: "44750", description: "Sloan Prism Synergy Spec 24V", units: 130, unitCost: 1.829, unitPrice: 3.293, profitPct: 44.4579 },
      { itemNo: "44350", description: "SLOAN 24VDC 100W POWER SUPPLY", units: 2, unitCost: 36.083, unitPrice: 64.956, profitPct: 44.4501 },
      { itemNo: "13090", description: "ACM 4'x 8' LED Grade", units: 3.5, unitCost: 61.805, unitPrice: 111.26, profitPct: 44.4499 },
      { itemNo: "EST ELECTRICAL", description: "Estimate for Misc Electrical Materials", units: 50, unitCost: 0, unitPrice: 1, profitPct: 100 },
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 50, unitCost: 0, unitPrice: 3, profitPct: 100 },
      ],
      extraLabor: [
      { workCode: 2010, description: "Routing Labor — setup", hours: 2 },
      { workCode: 2010, description: "Routing Labor — copy", hours: 8.25 },
      { workCode: 2010, description: "Routing Labor — push thru", hours: 16.25 },
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 17.75 },
      { workCode: 2110, description: "Paint Prep Labor", hours: 8.5 },
      { workCode: 2112, description: "Paint Cabinet & Letters Labor", hours: 6.75 },
      { workCode: 2212, description: "LED Wiring Labor", hours: 7.25 },
      { workCode: 2215, description: "Assembly Labor", hours: 6.75 },
      { workCode: 2313, description: "Routed Face Labor", hours: 1.75 },
      { workCode: 2110, description: "Paint Prep Labor — extra color", hours: 1 },
      ],
    },
    {
      id: "cnb-p6",
      typeId: "freeform-tm",
      label: "Pole cover or large reveals/ornaments",
      inputs: { description: "Pole cover" },
      extraMaterials: [
      { itemNo: "24055", description: ".090 Mil Alum 3003", units: 40, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.4474 },
      { itemNo: "20050", description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 70, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.4516 },
      { itemNo: "24055", description: ".090 Mil Alum 3003", units: 40, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.4474 },
      { itemNo: "28050", description: "2 X 2 X .187 Angle Iron", units: 10, unitCost: 1.639, unitPrice: 2.95, profitPct: 44.4407 },
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 13.5, unitCost: 0, unitPrice: 3, profitPct: 100 },
      { itemNo: "EST PAINT - CUSTOM", description: "Estimate for Custom Paint Color", units: 6435, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44 },
      ],
      extraLabor: [
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 7.25 },
      { workCode: 2110, description: "Paint Prep Labor", hours: 3.25 },
      { workCode: 2112, description: "Paint Cabinet & Letters Labor", hours: 2.5 },
      { workCode: 2110, description: "Paint Prep Labor — extra paint color", hours: 1 },
      { workCode: 2011, description: "Cabinet Metal Labor — radius/angle", hours: 1.8125 },
      { workCode: 2215, description: "Assembly Labor — Mount Flexi Brite LED product", hours: 6 },
      ],
    },
    {
      id: "cnb-p7",
      typeId: "freeform-tm",
      label: "Pole cover or large reveals/ornaments (#2)",
      inputs: { description: "Pole cover (2)" },
      extraMaterials: [
      { itemNo: "24055", description: ".090 Mil Alum 3003", units: 100, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.4474 },
      { itemNo: "20050", description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 90, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.4516 },
      { itemNo: "24055", description: ".090 Mil Alum 3003", units: 60, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.4474 },
      { itemNo: "28050", description: "2 X 2 X .187 Angle Iron", units: 10, unitCost: 1.639, unitPrice: 2.95, profitPct: 44.4407 },
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 50, unitCost: 0, unitPrice: 3, profitPct: 100 },
      { itemNo: "EST PAINT - CUSTOM", description: "Estimate for Custom Paint Color", units: 16000, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44 },
      ],
      extraLabor: [
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 13.25 },
      { workCode: 2110, description: "Paint Prep Labor", hours: 8.5 },
      { workCode: 2112, description: "Paint Cabinet & Letters Labor", hours: 6.75 },
      { workCode: 2215, description: "Assembly Labor — Mount FCO's", hours: 3 },
      ],
    },
    {
      id: "cnb-p8",
      typeId: "freeform-tm",
      label: "Structural Steel Fabrication",
      inputs: { description: "Structural Steel Fab" },
      extraMaterials: [
      { itemNo: "75005", description: "Red Oxide Primer", units: 2, unitCost: 7.625, unitPrice: 13.726, profitPct: 44.4485 },
      { itemNo: "75055", description: "3\" Fuzzy Paint Roller", units: 2, unitCost: 1.558, unitPrice: 2.805, profitPct: 44.4563 },
      { itemNo: "75090", description: "3\" Paint Brush", units: 2, unitCost: 0.68, unitPrice: 1.224, profitPct: 44.4444 },
      ],
      extraLabor: [
      { workCode: 2016, description: "Structural Steel Metal Labor", hours: 4 },
      ],
    },
    {
      id: "cnb-p9",
      typeId: "freeform-tm",
      label: "Reveal",
      inputs: { description: "Reveal" },
      extraMaterials: [
      { itemNo: "25050", description: "3 x .125 Arch Alum Sq Tube 24'", units: 30, unitCost: 6.448, unitPrice: 11.608, profitPct: 44.4521 },
      { itemNo: "20050", description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 10, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.4516 },
      { itemNo: "EST PAINT - CUSTOM", description: "Estimate for Custom Paint Color", units: 2300, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44 },
      ],
      extraLabor: [
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 3.5 },
      { workCode: 2110, description: "Paint Prep Labor", hours: 1.75 },
      { workCode: 2112, description: "Paint Cabinet & Letters Labor", hours: 1.75 },
      ],
    },
    {
      id: "cnb-p10",
      typeId: "freeform-tm",
      label: "Reveal (#2)",
      inputs: { description: "Reveal (2)" },
      extraMaterials: [
      { itemNo: "25050", description: "3 x .125 Arch Alum Sq Tube 24'", units: 30, unitCost: 6.448, unitPrice: 11.608, profitPct: 44.4521 },
      { itemNo: "20050", description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 10, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.4516 },
      { itemNo: "EST PAINT - CUSTOM", description: "Estimate for Custom Paint Color", units: 2100, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44 },
      ],
      extraLabor: [
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 3.25 },
      { workCode: 2110, description: "Paint Prep Labor", hours: 1.5 },
      { workCode: 2112, description: "Paint Cabinet & Letters Labor", hours: 1.5 },
      ],
    },
    {
      id: "cnb-p11",
      typeId: "freeform-tm",
      label: "EMC Fabrication and Assembly",
      inputs: { description: "EMC assembly" },
      extraMaterials: [
      { itemNo: "24036", description: ".063 Black Alum", units: 60, unitCost: 4.214, unitPrice: 7.586, profitPct: 44.4503 },
      { itemNo: "EST HARDWARE-ADHESIV", description: "Estimate for Misc Hardware & Adhesive Materials", units: 50, unitCost: 0, unitPrice: 3, profitPct: 100 },
      { itemNo: "EST ELECTRICAL", description: "Estimate for Misc Electrical Materials", units: 50, unitCost: 0, unitPrice: 1, profitPct: 100 },
      { itemNo: "28050", description: "2 X 2 X .187 Angle Iron", units: 60, unitCost: 1.639, unitPrice: 2.95, profitPct: 44.4407 },
      { itemNo: "75005", description: "Red Oxide Primer", units: 1, unitCost: 7.625, unitPrice: 13.726, profitPct: 44.4485 },
      { itemNo: "75135", description: "2\" Chip Brush", units: 1, unitCost: 0.673, unitPrice: 1.212, profitPct: 44.4719 },
      ],
      extraLabor: [
      { workCode: 2011, description: "Cabinet Metal Labor", hours: 10.75 },
      { workCode: 2216, description: "Electronics Wiring & Assembly Labor", hours: 10.75 },
      { workCode: 2116, description: "Hand Painting Labor", hours: 2.5 },
      ],
    },
  ],
};
