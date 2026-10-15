/**
 * Print a whole HTML document without opening a window (pop-ups can be
 * blocked inside the Power Apps host): it goes into a hidden frame, which
 * prints once its images have loaded, then removes itself.
 */
export function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  const images = [...doc.images];
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1500);
  };
  const pending = images.filter((i) => !i.complete);
  if (pending.length === 0) setTimeout(go, 50);
  else {
    let left = pending.length;
    for (const img of pending) {
      const done = () => --left === 0 && go();
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    }
  }
}
