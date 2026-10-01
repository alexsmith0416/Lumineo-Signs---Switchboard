/**
 * Thumbnails made in the browser for the Sketch column: page 1 of a PDF (via
 * pdf.js) or a picture, scaled into a small JPEG data: URL. Used by the sketch
 * chooser's preview and when a sketch is chosen / uploaded, so the thumbnail
 * shows (and is saved) at once. Data URLs are what Power Apps lets the app show.
 *
 * pdf.js runs on the main thread: its worker is loaded as an ordinary module
 * (which sets globalThis.pdfjsWorker), because Power Apps hosting doesn't let
 * the app start a Web Worker — with one, pdf.js waited forever.
 */
const MAX_W = 320;
const MAX_H = 240;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const DRAW_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} took too long`)), ms);
    p.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

function toJpeg(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(MAX_W / w, MAX_H / h, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

let pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;
function loadPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = (async () => {
      // Main-thread mode: importing the worker module registers its handler on
      // globalThis.pdfjsWorker, which pdf.js uses instead of starting a Worker.
      await import("pdfjs-dist/build/pdf.worker.min.mjs");
      return await import("pdfjs-dist");
    })();
  }
  return pdfjsReady;
}

/** Page 1 of a PDF (its bytes) as a small JPEG data: URL. */
export async function pdfThumbnail(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Render at 2x the thumbnail size so the scaled-down result stays crisp.
    const scale = Math.min((MAX_W * 2) / base.width, (MAX_H * 2) / base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return toJpeg(canvas, canvas.width, canvas.height);
  } finally {
    void doc.destroy();
  }
}

async function imageThumbnail(bytes: Uint8Array, type: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: type === "jpg" ? "image/jpeg" : `image/${type}` }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return toJpeg(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface SketchRender {
  /** A small JPEG data: URL ("" when it couldn't be drawn). */
  dataUrl: string;
  /** Why not, when it couldn't. */
  error?: string;
}

/** Draw a SharePoint file's thumbnail (page 1 of a PDF, or a picture). */
export async function renderSketchThumbnailDetailed(fileRef: string): Promise<SketchRender> {
  const type = (fileRef.split(".").pop() ?? "").toLowerCase();
  if (type !== "pdf" && !["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(type)) {
    return { dataUrl: "", error: `No preview for .${type} files` };
  }
  let bytes: Uint8Array;
  try {
    const sp = await import("./sharepoint");
    bytes = await withTimeout(sp.fileBytes(fileRef), DOWNLOAD_TIMEOUT_MS, "Downloading the file");
  } catch (e) {
    console.warn("[sketches] download failed", fileRef, e);
    return { dataUrl: "", error: `Couldn't download it: ${e instanceof Error ? e.message : String(e)}` };
  }
  try {
    const dataUrl = await withTimeout(
      type === "pdf" ? pdfThumbnail(bytes) : imageThumbnail(bytes, type),
      DRAW_TIMEOUT_MS,
      "Drawing the preview",
    );
    return dataUrl ? { dataUrl } : { dataUrl: "", error: "Couldn't draw it" };
  } catch (e) {
    console.warn("[sketches] drawing failed", fileRef, `(${bytes.length} bytes)`, e);
    return { dataUrl: "", error: `Couldn't draw it (${bytes.length.toLocaleString()} bytes): ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** A small JPEG data: URL of a SharePoint file, or "" when it can't be drawn. */
export async function renderSketchThumbnail(fileRef: string): Promise<string> {
  return (await renderSketchThumbnailDetailed(fileRef)).dataUrl;
}
