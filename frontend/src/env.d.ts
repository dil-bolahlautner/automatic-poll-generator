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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 