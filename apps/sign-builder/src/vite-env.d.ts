/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Estimating app, e.g. https://lumineo-estimating.vercel.app/.
   *  Set per-deploy in the Vercel/Netlify project. See docs/deploy.md. */
  readonly VITE_ESTIMATING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
