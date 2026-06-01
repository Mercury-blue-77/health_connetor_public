declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_PARENT_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
