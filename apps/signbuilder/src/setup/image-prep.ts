// Reference page images from a picked file: a full-size JPEG that fits a
// Dataverse text column (1 MB of characters) and a small thumbnail.
const MAX_CHARS = 950_000;
const FULL_SIDE = 2400;
const THUMB_WIDTH = 480;

function toJpeg(img: ImageBitmap, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get a white page, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function prepareReferenceImages(file: File): Promise<{ thumbnail: string; fullImage: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image (PNG or JPG). Save a PDF page as an image first.");
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(file);
  } catch {
    throw new Error("That image couldn't be read.");
  }
  let side = FULL_SIDE;
  let quality = 0.85;
  let full = toJpeg(img, side, quality);
  for (let i = 0; full.length > MAX_CHARS && i < 12; i++) {
    if (quality > 0.55) quality -= 0.1;
    else side = Math.round(side * 0.8);
    full = toJpeg(img, side, quality);
  }
  if (full.length > MAX_CHARS) throw new Error("The image is too big even after shrinking it — use a smaller one.");
  const thumbnail = toJpeg(img, THUMB_WIDTH * Math.max(1, img.height / img.width), 0.8);
  img.close();
  return { thumbnail, fullImage: full };
}
