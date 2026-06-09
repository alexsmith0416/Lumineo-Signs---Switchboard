// Sign-type catalog and grouping helpers used by the form cascade.
// Codes are the 2-letter identifiers that appear in the assembled product code.

export type SignTypeCode =
  | "WC" // Wall Sign
  | "MN" // Monument Sign
  | "PS" // Pole Sign
  | "PP" // Post & Panel
  | "AP" // Pan Sign
  | "EP" // Economy Pan Sign
  | "FL" // Channel Letters
  | "HL" // Halo Letters
  | "CL" // Combo Letters
  | "AL" // FCO Aluminum Letters
  | "CA" // Cast Aluminum Letters
  | "PL" // Formed Plastic Letters
  | "AC" // FCO Acrylic Letters
  | "EM"; // Electronic Message Center

export type SignType = {
  code: SignTypeCode;
  name: string;
  category: "cabinet" | "pan" | "letter" | "emc";
};

export const SIGN_TYPES: SignType[] = [
  { code: "WC", name: "Wall Sign",                category: "cabinet" },
  { code: "MN", name: "Monument Sign",            category: "cabinet" },
  { code: "PS", name: "Pole Sign",                category: "cabinet" },
  { code: "PP", name: "Post & Panel",             category: "cabinet" },
  { code: "AP", name: "Pan Sign",                 category: "pan"     },
  { code: "EP", name: "Economy Pan Sign",         category: "pan"     },
  { code: "FL", name: "Channel Letters",          category: "letter"  },
  { code: "HL", name: "Halo Letters",             category: "letter"  },
  { code: "CL", name: "Combo Letters",            category: "letter"  },
  { code: "AL", name: "FCO Aluminum Letters",     category: "letter"  },
  { code: "CA", name: "Cast Aluminum Letters",    category: "letter"  },
  { code: "PL", name: "Formed Plastic Letters",   category: "letter"  },
  { code: "AC", name: "FCO Acrylic Letters",      category: "letter"  },
  { code: "EM", name: "Electronic Message Center", category: "emc"    },
];

export const LETTER_TYPES: SignTypeCode[] = ["FL", "HL", "CL", "AL", "CA", "PL", "AC"];
export const PAN_TYPES:    SignTypeCode[] = ["AP", "EP"];
export const CABINET_TYPES: SignTypeCode[] = ["WC", "MN", "PS", "PP"];
export const INDOOR_ONLY:  SignTypeCode[] = ["AC", "CA"];           // surface a red banner
export const POLE_FOOTING_TYPES: SignTypeCode[] = ["MN", "PS", "PP"]; // steps 10/11/12 gate

export function getSignType(code: string): SignType | undefined {
  return SIGN_TYPES.find((t) => t.code === code);
}

export function isLetter(code: string): boolean {
  return LETTER_TYPES.includes(code as SignTypeCode);
}
export function isPan(code: string): boolean {
  return PAN_TYPES.includes(code as SignTypeCode);
}
export function isCabinet(code: string): boolean {
  return CABINET_TYPES.includes(code as SignTypeCode);
}
