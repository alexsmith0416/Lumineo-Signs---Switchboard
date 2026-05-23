// Spec reference image lookup. The canvas plan stores 18 spec-page images
// in the Lumineo SharePoint at:
//
//   https://luminousneon.sharepoint.com/sites/installationschedule/
//   Shared%20Documents/SignSpecPages/{file}.png
//
// The (signTypeCode, faceType) tuple selects the image. Mappings ship here
// as keys so swapping the actual filenames in (or moving them to Dataverse
// File columns) is a one-line edit. We also generate a tinted SVG fallback
// so the modal renders meaningfully in dev before the SharePoint URLs are
// pinned down.

import type { SignSpec } from "./SignSpec";

const SHAREPOINT_BASE =
  "https://luminousneon.sharepoint.com/sites/installationschedule/Shared%20Documents/SignSpecPages/";

// Stub mapping — fill in the actual SharePoint filenames as they're confirmed
// with Ops (see ALE-50 "18 URL mappings to SharePoint"). The keys are
// `${signTypeCode}-${faceType}` and the value is the filename + .png.
const REFERENCE_FILES: Record<string, string> = {
  // Wall sign cabinets
  "WC-AT":   "wall-cabinet-aluminum-face.png",
  "WC-PT":   "wall-cabinet-plex-face.png",
  "WC-RFPB": "wall-cabinet-routed-pushback.png",
  "WC-RFPT": "wall-cabinet-routed-pushthrough.png",
  // Monument
  "MN-AT":   "monument-aluminum-face.png",
  "MN-PT":   "monument-plex-face.png",
  "MN-RFPB": "monument-routed-pushback.png",
  // Pole + post-and-panel
  "PS-AT":   "pole-sign-aluminum.png",
  "PS-PT":   "pole-sign-plex.png",
  "PP-AT":   "post-and-panel.png",
  // Pan signs
  "AP-AT":   "pan-sign.png",
  "EP-AT":   "economy-pan.png",
  // EMC
  "EM-EM":   "emc-led-panel.png",
  // Letter sets
  "FL-AT":   "channel-letters.png",
  "FL-PT":   "channel-letters-plex.png",
  "HL-AT":   "halo-letters.png",
  "CL-AT":   "combo-letters.png",
  "AL-AT":   "fco-aluminum.png",
};

export type SpecReferenceImage = {
  /** Absolute URL of the production image (may 404 until SharePoint files land). */
  href: string;
  /** Inline SVG data URI used as the thumbnail until the real image loads. */
  placeholder: string;
  /** Short caption shown under the modal — useful when the image is generic. */
  caption: string;
};

export function getSpecReferenceImage(spec: SignSpec): SpecReferenceImage | null {
  if (!spec.signTypeCode || !spec.faceType) return null;
  const key = `${spec.signTypeCode}-${spec.faceType}`;
  const file = REFERENCE_FILES[key];
  const href = file ? SHAREPOINT_BASE + file : "";
  return {
    href,
    placeholder: tintedSvg(spec),
    caption: file
      ? `Reference: ${file}`
      : `No reference image mapped for ${key} yet — using placeholder.`,
  };
}

// Generates a 480×360 SVG that visually distinguishes specs by sign-type + face
// type. Not a real diagram — just so the modal has something meaningful to
// render until the SharePoint URLs are wired up.
function tintedSvg(spec: SignSpec): string {
  const fill = spec.vinylHex || "#141464";
  const accent = spec.illumination === "IL" || spec.illumination === "EL"
    ? "#F2994A"
    : "#8b91a3";
  const label = [spec.signTypeCode, spec.faceType].filter(Boolean).join(" / ");
  const productCode = spec.productCode || "(no code)";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360">
    <rect width="480" height="360" fill="#f7f8fa"/>
    <rect x="40" y="60" width="400" height="240" rx="14" fill="${fill}" stroke="#141464" stroke-width="2"/>
    <rect x="60" y="90" width="360" height="40" rx="6" fill="rgba(255,255,255,0.85)"/>
    <text x="240" y="118" font-family="-apple-system, Segoe UI, sans-serif" font-size="22" font-weight="800" fill="#141464" text-anchor="middle" letter-spacing="2">LUMINEO SIGNS</text>
    <rect x="60" y="150" width="360" height="120" rx="6" fill="rgba(255,255,255,0.92)"/>
    <text x="240" y="200" font-family="ui-monospace, Menlo, monospace" font-size="22" font-weight="700" fill="#141464" text-anchor="middle">${escape(productCode)}</text>
    <text x="240" y="240" font-family="-apple-system, Segoe UI, sans-serif" font-size="13" font-weight="600" fill="#4a4f5e" text-anchor="middle">${escape(label)}</text>
    <circle cx="60" cy="60" r="14" fill="${accent}"/>
    <text x="60" y="65" font-family="-apple-system, Segoe UI, sans-serif" font-size="14" font-weight="800" fill="white" text-anchor="middle">L</text>
    <text x="240" y="334" font-family="-apple-system, Segoe UI, sans-serif" font-size="11" font-weight="700" fill="#8b91a3" text-anchor="middle" letter-spacing="2">REFERENCE PLACEHOLDER</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
