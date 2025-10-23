/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_USERS_FILE_ID: string;
  readonly VITE_DRIVE_KINDERTRAINING_FILE_ID: string;
  readonly VITE_DRIVE_KINDERTRAINING_PERSONEN_FILE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}