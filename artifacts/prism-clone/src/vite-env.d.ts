/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin, e.g. https://my-api.example.com (no /api suffix). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
