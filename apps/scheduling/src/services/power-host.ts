/**
 * Power Apps player host helpers.
 *
 * The purple Power Apps header is player chrome rendered by apps.powerapps.com
 * AROUND the app's iframe — the app is hosted on a separate origin, so it can't
 * hide the header with CSS or DOM code. The only supported lever is the
 * `hideNavBar=true` query-string param on the play URL:
 *   https://learn.microsoft.com/power-apps/developer/code-apps/system-limits-configuration
 *
 * So hiding / showing the header means navigating the TOP window to the
 * with/without-param play URL (a full reload). We reconstruct that URL from the
 * deployed environment + app id (see power.config.json).
 */

// Deploy target — must match power.config.json (environmentId + appId).
const ENVIRONMENT_ID = "484cdd3c-4409-e741-bbd5-7c210e00310e";
const APP_ID = "d954d7c6-698a-4563-8e03-f44df090778f";

/** The play URL, with the Power Apps header hidden or shown. */
export function playUrl(hideHeader: boolean): string {
  const base = `https://apps.powerapps.com/play/e/${ENVIRONMENT_ID}/a/${APP_ID}`;
  return hideHeader ? `${base}?hideNavBar=true` : base;
}

/**
 * True when the app is running inside the Power Apps player (framed), rather
 * than a plain `npm run dev` / test page where it is the top document. We can't
 * read the cross-origin top URL, but the framed check is enough to know whether
 * there's any player chrome to toggle.
 */
export function isInPowerPlayer(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin top window can throw on access → we're definitely framed.
    return true;
  }
}

/**
 * Reload the whole app at the play URL with/without the Power Apps header.
 * No-op outside the player (dev/test), where there's no host chrome to hide.
 * Must be called from a user gesture (e.g. a toggle click) — browsers only
 * allow a cross-origin frame to navigate the top window with user activation.
 */
export function applyHeaderVisibility(hideHeader: boolean): void {
  if (!isInPowerPlayer()) return;
  const url = playUrl(hideHeader);
  try {
    window.top!.location.href = url;
  } catch {
    // Fallback if direct top navigation is blocked.
    window.open(url, "_top");
  }
}
