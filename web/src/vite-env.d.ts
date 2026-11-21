/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REWIND_ADDRESS?: string;
  readonly VITE_REWIND_DEPLOY_BLOCK?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
