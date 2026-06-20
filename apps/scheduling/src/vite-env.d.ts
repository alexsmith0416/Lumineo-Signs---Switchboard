/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "live" to point the production store at Dataverse instead of mocks. */
  readonly VITE_DATA_SOURCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
