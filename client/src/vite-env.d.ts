/// <reference types="vite/client" />
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_WS_URL: string;
  readonly VITE_NASA_API_KEY?: string;
}
