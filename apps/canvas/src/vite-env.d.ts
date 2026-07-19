/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONSTRUCTOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
