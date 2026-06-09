// Cross-app configuration for the Estimating app.
//
// The Estimating app links back to Sign Builder Pro (the reverse of the
// "Send to Estimating" handoff) so an estimator can open the originating
// sign spec. Resolve the SBP base URL with the same precedence the SBP
// side uses for the Estimating URL — see docs/deploy.md → "Connecting the
// two apps".

const DEFAULT_SIGN_BUILDER_BASE = 'https://signbuilderpro.lumineosigns.com/';

/** Base URL of the Sign Builder Pro app. Precedence:
 *   1. `window.LUMINEO_SIGN_BUILDER_URL` — runtime override (no rebuild).
 *   2. `import.meta.env.VITE_SIGN_BUILDER_URL` — build-time env (per deploy).
 *   3. the production default. */
export function getSignBuilderBaseUrl(): string {
  const w = (typeof window !== 'undefined' ? window : undefined) as
    | { LUMINEO_SIGN_BUILDER_URL?: string }
    | undefined;
  const fromEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_SIGN_BUILDER_URL as string | undefined)
      : undefined;
  return w?.LUMINEO_SIGN_BUILDER_URL ?? fromEnv ?? DEFAULT_SIGN_BUILDER_BASE;
}

/** Deep link to a specific spec in Sign Builder Pro's Builder. SBP uses a
 *  HashRouter and `useLaunchParams()` reads `specId` from the hash query —
 *  see apps/sign-builder/src/app/launchParams.ts. */
export function signBuilderSpecUrl(specId: string): string {
  const base = getSignBuilderBaseUrl().replace(/\/+$/, '');
  return `${base}/#/builder?specId=${encodeURIComponent(specId)}`;
}
