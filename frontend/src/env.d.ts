/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_JIRA_HOST: string;
    readonly REACT_APP_API_URL: string;
  }
}

interface ImportMetaEnv {
  readonly VITE_JIRA_HOST: string;
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_API_URL: string;
  readonly VITE_WEBSOCKET_URL: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 