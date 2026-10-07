/**
 * Which deploy this tab is running (pure).
 *
 * A Power Apps tab keeps the code it loaded until it's reloaded, so after a
 * deploy, a session left open keeps running the OLD code — and the shop-floor
 * tick processor (store/task-completion-processor.ts) in it would apply ticks
 * the old way (Oct 6: three ticks lost their History details + AUTO tag).
 *
 * Each bundle carries its build time (`__APP_BUILD__`, vite.config.ts). The
 * newest build any deployed session has started is kept in the shared Jobs
 * config (crfdf_jobsview, key LATEST_BUILD_KEY): a freshly loaded deployed
 * tab records its build there when it's newer, and a tab whose build is OLDER
 * than the recorded one doesn't process ticks.
 */
export const LATEST_BUILD_KEY = "appLatestBuild";

/** This bundle's build time (0 where the define isn't set, e.g. tests). */
export const APP_BUILD: number = typeof __APP_BUILD__ === "number" ? __APP_BUILD__ : 0;

/** The recorded latest build, from the config value (0 = none / unreadable). */
export function recordedBuild(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Is a tab on build `own` out of date, given the recorded latest? An unknown
 *  own build (0) never counts as outdated. */
export function isOutdatedBuild(own: number, recorded: unknown): boolean {
  return own > 0 && recordedBuild(recorded) > own;
}

/** Should a tab on build `own` record itself as the latest? */
export function shouldRecordBuild(own: number, recorded: unknown): boolean {
  return own > 0 && own > recordedBuild(recorded);
}
