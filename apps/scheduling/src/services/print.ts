// Printing from inside the Power Apps Code App iframe: a plain window.print()
// there produces a blank page (the sandboxed app iframe isn't the print root).
// Instead we open a fresh same-tab window, copy the app's stylesheets into it,
// drop in just the markup we want on paper, and print THAT window.

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"]/g,
    (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as Record<string, string>)[c]!,
  );

/** Collect the app's stylesheets as HTML for the print window. <link> hrefs are
 *  resolved to absolute URLs (the app builds with a relative base, so the raw
 *  href wouldn't resolve in a blank window); inline <style> tags copy verbatim. */
function collectStyles(): string {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) =>
      el.tagName === "LINK"
        ? `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`
        : el.outerHTML,
    )
    .join("\n");
}

/**
 * Print the given markup reliably. Opens a new window styled with the app's CSS,
 * writes `bodyHtml` into it, and triggers the browser print dialog once its
 * stylesheets have loaded. Falls back to window.print() if pop-ups are blocked.
 */
export function printMarkup(title: string, bodyHtml: string): void {
  const w = window.open("", "_blank", "width=1200,height=850");
  if (!w) {
    window.print();
    return;
  }
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      collectStyles() +
      `<style>@page{margin:12mm}` +
      `body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
      `.print-doc{padding:10px}` +
      `.print-doc__title{font-size:15px;font-weight:700;margin:0 0 10px;color:#111}` +
      `</style></head><body><div class="print-doc">${bodyHtml}</div></body></html>`,
  );
  w.document.close();

  const trigger = () => {
    w.focus();
    w.print();
  };
  // Give the linked stylesheets a beat to load before printing.
  if (w.document.readyState === "complete") window.setTimeout(trigger, 400);
  else w.addEventListener("load", () => window.setTimeout(trigger, 400));
}
