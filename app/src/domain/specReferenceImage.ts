// Spec reference image lookup. The 30+ spec pages live in SharePoint under
// the Sign Spec Pages folder; the same set is bundled into `app/public/
// spec-images/` so the app shows real reference imagery in dev and as the
// offline fallback in deployed builds.
//
// SharePoint folder (source of truth, surfaced as an "Open" link in the
// modal so Ops can navigate to the editable master):
//   https://luminousneon.sharepoint.com/:f:/s/installationschedule/
//   IgCICY5o8mlOT7c8fCvX5reKAUAU8IBC97OAv05zbg9C2WI?e=VXPnx5
//
// The lookup branches by sign-type category — cabinets fan out on
// (faces, illumination, faceType); letters / pans / post-and-panel / EMC
// each have a single representative image.

import type { SignSpec } from "./SignSpec";

export const SPEC_PAGES_FOLDER_URL =
  "https://luminousneon.sharepoint.com/:f:/s/installationschedule/IgCICY5o8mlOT7c8fCvX5reKAUAU8IBC97OAv05zbg9C2WI?e=VXPnx5";

const LOCAL_BASE = "spec-images/";

// One file pair (full + thumb) per representative spec page.
type FileStem = string;   // e.g. "Cabinets/ST-04_NonIllum_Cabinet"

// Letters — one image per sign type, independent of face type.
const LETTER_STEMS: Partial<Record<SignSpec["signTypeCode"], FileStem>> = {
  FL: "ChannelLetters/ST-12_Front_Lit_Channel_Letters",
  HL: "ChannelLetters/ST-13_Halo_Lit_Channel_Letters",
  CL: "ChannelLetters/ST-14_Combo_Lit_Channel_Letters",
  AL: "FCOs/ST-15_FCO_Aluminum_Letters",
  CA: "FCOs/ST-16_Cast_Aluminum_Letters",
  PL: "FCOs/ST-18_Formed_Plastic_Letters",
  AC: "FCOs/ST-19_FCO_Acrylic_Letters",
};

function resolveFileStem(spec: SignSpec): FileStem | null {
  const t = spec.signTypeCode;
  if (!t) return null;

  // Letters, pans, EMC, post-and-panel: a single image per sign type.
  if (LETTER_STEMS[t]) return LETTER_STEMS[t]!;
  if (t === "AP") return "Pans/ST-01_Aluminum_Pan_Sign";
  if (t === "EP") return "Pans/ST-02_Economy_Pan_Sign";
  if (t === "PP") return "PostPanels/ST-03_Post_Panel_Sign";
  if (t === "EM") return "Electronics/ST-22_EMC_Standards";

  // Cabinets (WC, MN, PS): need faces + illumination + faceType.
  if (t === "WC" || t === "MN" || t === "PS") {
    if (spec.illumination === "NI") return "Cabinets/ST-04_NonIllum_Cabinet";
    if (!spec.faceType) return null;
    const df = spec.faces === "DF";

    // Routed copy (push-back / push-through) and aluminum trim cap all map to
    // the routed-copy cabinet pages — they describe the same construction.
    if (spec.faceType === "RFPB" || spec.faceType === "RFPT" || spec.faceType === "AT") {
      return df
        ? "Cabinets/ST-11_DF_Routed_Copy_Cabinet"
        : "Cabinets/ST-10_SF_Routed_Copy_Cabinet";
    }
    // Plex face / acrylic polycarbonate
    if (spec.faceType === "PT") {
      return df
        ? "Cabinets/ST-07_DF_Acrylic_Poly_Cabinet"
        : "Cabinets/ST-06_SF_Acrylic_Poly_Cabinet";
    }
    // Direct print / digital face → flex face cabinet pages
    if (spec.faceType === "DF") {
      return df
        ? "Cabinets/ST-09_DF_Flex_Face_Cabinet"
        : "Cabinets/ST-08_SF_Flex_Face_Cabinet";
    }
  }

  return null;
}

export type SpecReferenceImage = {
  /** Bundled thumb path — always loads. */
  thumb: string;
  /** Bundled full-size path — used in the modal. */
  full: string;
  /** Human caption shown below the modal image. */
  caption: string;
};

export function getSpecReferenceImage(spec: SignSpec): SpecReferenceImage | null {
  const stem = resolveFileStem(spec);
  if (!stem) return null;
  // Pretty caption: strip the leading "ST-NN_" sequence and the underscores.
  const file = stem.split("/").pop() ?? stem;
  const caption = file
    .replace(/^ST-\d+_/, "")
    .replace(/_/g, " ");
  return {
    thumb: `${LOCAL_BASE}${stem}_thumb.jpg`,
    full:  `${LOCAL_BASE}${stem}_full.jpg`,
    caption,
  };
}
