/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "live" to point the production store at Dataverse instead of mocks. */
  readonly VITE_DATA_SOURCE?: string;
}

/** Build time of this bundle (ms since epoch), set by vite.config.ts. */
declare const __APP_BUILD__: number;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
