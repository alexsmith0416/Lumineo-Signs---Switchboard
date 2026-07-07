// Reference tables extracted from the STSIGN5.xls engineering workbook
// (Uniform Building Code 1994 + AISC 9th Edition). Values are transcribed
// verbatim from the workbook's "Wind" and "Tables" sheets so the app
// reproduces the spreadsheet's results exactly.

export type Exposure = 'B' | 'C' | 'D';

/** Heights (ft) for the UBC table 16-G combined height/exposure/gust rows. */
export const CE_HEIGHTS: readonly number[] = [
  15, 20, 25, 30, 40, 60, 80, 100, 120, 160, 200, 300, 400,
];

/** Ce (combined height, exposure and gust factor) per exposure, by CE_HEIGHTS row. */
export const CE: Readonly<Record<Exposure, readonly number[]>> = {
  D: [1.39, 1.45, 1.5, 1.54, 1.62, 1.73, 1.81, 1.88, 1.93, 2.02, 2.1, 2.23, 2.34],
  C: [1.06, 1.13, 1.19, 1.23, 1.31, 1.43, 1.53, 1.61, 1.67, 1.79, 1.87, 2.05, 2.19],
  B: [0.62, 0.67, 0.72, 0.76, 0.84, 0.95, 1.04, 1.13, 1.2, 1.31, 1.42, 1.63, 1.8],
};

export const EXPOSURE_DESCRIPTIONS: Readonly<Record<Exposure, string>> = {
  B: "20% of terrain 20' high for 1 mile (urban / suburban)",
  C: 'Flat terrain, generally open for 1/2 mile (most sites)',
  D: 'Flat terrain, facing large bodies of water',
};

/** UBC seismic zone factor Z, from the workbook's Wind sheet. */
export const SEISMIC_Z: Readonly<Record<number, number>> = {
  1: 0.075,
  2: 0.2,
  3: 0.3,
  4: 0.4,
};

export type SectionShape = 'P' | 'TS'; // round pipe | square tube

export interface SteelSection {
  /** Display name as printed in the workbook, e.g. `10"(.365)` or `8XX.25`. */
  name: string;
  /** Section modulus provided, in^3. */
  sm: number;
  /** Recommended sleeve depth for a stepped column splice, in (null = n/a). */
  sleeveIn: number | null;
  /** Cross-section steel area, in^2. */
  areaSqIn: number;
  /** Outside dimension, in (OD for pipe, side for square tube). */
  odIn: number;
  /** Wall thickness, in. */
  wallIn: number;
}

// Round pipe, ASTM A53 Grade B (Fy = 35 ksi). Ordered smallest → largest;
// selection picks the first section whose provided SM exceeds the required SM
// (matching the workbook's bracketed VLOOKUP).
export const PIPE_SECTIONS: readonly SteelSection[] = [
  { name: '3"(.216)', sm: 1.72, sleeveIn: 12, areaSqIn: 2.23, odIn: 3.5, wallIn: 0.216 },
  { name: '3.5"(.226)', sm: 2.39, sleeveIn: 12, areaSqIn: 2.68, odIn: 4, wallIn: 0.226 },
  { name: '4"(.237)', sm: 3.21, sleeveIn: 12, areaSqIn: 3.17, odIn: 4.5, wallIn: 0.237 },
  { name: '5"(.258)', sm: 5.45, sleeveIn: 12, areaSqIn: 4.3, odIn: 5.563, wallIn: 0.258 },
  { name: '6"(.280)', sm: 8.5, sleeveIn: 12, areaSqIn: 5.58, odIn: 6.625, wallIn: 0.28 },
  { name: '8"(.322)', sm: 16.8, sleeveIn: 12, areaSqIn: 8.4, odIn: 8.625, wallIn: 0.322 },
  { name: '10"(.365)', sm: 29.9, sleeveIn: 18, areaSqIn: 11.91, odIn: 10.75, wallIn: 0.365 },
  { name: '12"(.375)', sm: 43.8, sleeveIn: 18, areaSqIn: 14.58, odIn: 12.75, wallIn: 0.375 },
  { name: '14"(.375)', sm: 53.2, sleeveIn: 24, areaSqIn: 16.05, odIn: 14, wallIn: 0.375 },
  { name: '16"(.375)', sm: 70.3, sleeveIn: 24, areaSqIn: 18.41, odIn: 16, wallIn: 0.375 },
  { name: '18"(.375)', sm: 89.6, sleeveIn: 30, areaSqIn: 20.76, odIn: 18, wallIn: 0.375 },
  { name: '20"(.375)', sm: 111.3, sleeveIn: 30, areaSqIn: 23.12, odIn: 20, wallIn: 0.375 },
  { name: '22"(.375)', sm: 135.4, sleeveIn: 36, areaSqIn: 25.48, odIn: 22, wallIn: 0.375 },
  { name: '24"(.375)', sm: 161.9, sleeveIn: 36, areaSqIn: 27.83, odIn: 24, wallIn: 0.375 },
  { name: '26"(.375)', sm: 190.6, sleeveIn: 42, areaSqIn: 30.19, odIn: 26, wallIn: 0.375 },
  { name: '28"(.375)', sm: 221.8, sleeveIn: 42, areaSqIn: 32.54, odIn: 28, wallIn: 0.375 },
  { name: '30"(.375)', sm: 254.8, sleeveIn: 48, areaSqIn: 34.9, odIn: 30, wallIn: 0.375 },
  { name: '32"(.375)', sm: 291, sleeveIn: 48, areaSqIn: 37.26, odIn: 32, wallIn: 0.375 },
  { name: '34"(.375)', sm: 329.2, sleeveIn: 54, areaSqIn: 39.61, odIn: 34, wallIn: 0.375 },
  { name: '36"(.375)', sm: 370.2, sleeveIn: 54, areaSqIn: 41.97, odIn: 36, wallIn: 0.375 },
  { name: '42"(.375)', sm: 506.1, sleeveIn: 66, areaSqIn: 49.04, odIn: 42, wallIn: 0.375 },
  { name: '42"(.500)', sm: 668.37, sleeveIn: 66, areaSqIn: 65.19, odIn: 42, wallIn: 0.5 },
  { name: '42"(.750)', sm: 984.73, sleeveIn: null, areaSqIn: 97.19, odIn: 42, wallIn: 0.75 },
];

// Square structural tube, ASTM A500 Grade B (Fy = 46 ksi).
// Name format is side x side x wall, e.g. `8XX.25` = 8" x 8" x 1/4".
export const TUBE_SECTIONS: readonly SteelSection[] = [
  { name: '3XX.19', sm: 1.73, sleeveIn: 12, areaSqIn: 2.02, odIn: 3, wallIn: 0.1875 },
  { name: '3XX.25', sm: 2.1, sleeveIn: 12, areaSqIn: 2.59, odIn: 3, wallIn: 0.25 },
  { name: '4XX.19', sm: 3.3, sleeveIn: 12, areaSqIn: 2.77, odIn: 4, wallIn: 0.1875 },
  { name: '4XX.25', sm: 4.11, sleeveIn: 12, areaSqIn: 3.59, odIn: 4, wallIn: 0.25 },
  { name: '4XX.31', sm: 4.79, sleeveIn: 12, areaSqIn: 4.36, odIn: 4, wallIn: 0.3125 },
  { name: '5XX.19', sm: 5.36, sleeveIn: 12, areaSqIn: 3.52, odIn: 5, wallIn: 0.1875 },
  { name: '5XX.25', sm: 6.78, sleeveIn: 12, areaSqIn: 4.59, odIn: 5, wallIn: 0.25 },
  { name: '6XX.19', sm: 7.93, sleeveIn: 12, areaSqIn: 4.27, odIn: 6, wallIn: 0.1875 },
  { name: '6XX.25', sm: 10.1, sleeveIn: 12, areaSqIn: 5.59, odIn: 6, wallIn: 0.25 },
  { name: '7XX.19', sm: 11, sleeveIn: 12, areaSqIn: 5.02, odIn: 7, wallIn: 0.1875 },
  { name: '8XX.19', sm: 14.6, sleeveIn: 12, areaSqIn: 5.77, odIn: 8, wallIn: 0.1875 },
  { name: '8XX.25', sm: 18.8, sleeveIn: 12, areaSqIn: 7.59, odIn: 8, wallIn: 0.25 },
  { name: '8XX.31', sm: 22.7, sleeveIn: 12, areaSqIn: 9.36, odIn: 8, wallIn: 0.3125 },
  { name: '8XX.37', sm: 26.4, sleeveIn: 12, areaSqIn: 11.1, odIn: 8, wallIn: 0.375 },
  { name: '10XX.25', sm: 30.1, sleeveIn: 18, areaSqIn: 9.59, odIn: 10, wallIn: 0.25 },
  { name: '10XX.31', sm: 36.7, sleeveIn: 18, areaSqIn: 11.9, odIn: 10, wallIn: 0.3125 },
  { name: '12XX.25', sm: 44.1, sleeveIn: 18, areaSqIn: 11.6, odIn: 12, wallIn: 0.25 },
  { name: '12XX.31', sm: 54, sleeveIn: 18, areaSqIn: 14.4, odIn: 12, wallIn: 0.3125 },
  { name: '12XX.37', sm: 63.4, sleeveIn: 18, areaSqIn: 17.1, odIn: 12, wallIn: 0.375 },
  { name: '14XX.31', sm: 74.6, sleeveIn: 24, areaSqIn: 16.9, odIn: 14, wallIn: 0.3125 },
  { name: '14XX.37', sm: 87.9, sleeveIn: 24, areaSqIn: 20.1, odIn: 14, wallIn: 0.375 },
  { name: '16XX.31', sm: 98.6, sleeveIn: 24, areaSqIn: 19.4, odIn: 16, wallIn: 0.3125 },
  { name: '16XX.37', sm: 116, sleeveIn: 24, areaSqIn: 23.1, odIn: 16, wallIn: 0.375 },
  { name: '16XX.50', sm: 150, sleeveIn: 24, areaSqIn: 30.4, odIn: 16, wallIn: 0.5 },
];

export function sectionsFor(shape: SectionShape): readonly SteelSection[] {
  return shape === 'P' ? PIPE_SECTIONS : TUBE_SECTIONS;
}

/** Standard specification notes, transcribed from the workbook's "Spec" sheet. */
export const SPEC_NOTES = {
  steel: [
    'Design and fabrication according to AISC-ASD, 9th edition.',
    'Plate, angle, channel, tee and wide flange: ASTM A36.',
    'Round pipe: ASTM A53 Grade B or equivalent.',
    'Square and rectangular tube: ASTM A500 Grade B.',
    'High strength bolts: ASTM A325, bearing type connections (snug tight).',
    'Machine bolts: ASTM A307.',
    'Anchor bolts or threaded rod: ASTM A36.',
    'Steel for reinforced concrete: Grade 60.',
  ],
  welding: [
    'Design and fabrication according to AWS D1.1.',
    'AWS certification required for all structural welders.',
    'E70XX electrodes for SMAW processes.',
    'F7X-EXXX electrodes for SAW processes.',
  ],
  concrete: [
    'Design and construction according to ACI 318-89, revised 1992.',
    "Compressive strength at 28 days, f'c = 2,500 psi minimum.",
    'Concrete poured into constrained earth excavations must cure under proper conditions for 4 days prior to sign box installation. (Exception: if the overall height of the sign is less than 20 feet and the sign pole is adequately braced against wind loads for a minimum of 4 days, the box may be installed the same day as the footing is poured.)',
    'For pier and caisson footings, concrete must be poured against undisturbed earth.',
    'Maintain a minimum 3" concrete cover over all embedded steel.',
  ],
} as const;
