// src/modules/benutzerverwaltung/services/UsersAdminStore.ts
/* Verwaltung von users.json über DriveClientCore */

import { downloadJson, overwriteJsonContent } from "@/lib/drive/DriveClientCore";
import { IDS } from "@/config/driveIds";
import type { ModuleKey } from "@/modules/registry";

export type UserRecord = {
  username: string;
  displayName: string;
  password: string;
  modules: ModuleKey[];
  active: boolean;
  updatedAt?: string;
  // unbekannte Felder aus users.json behalten
  [key: string]: any;
};

export type UsersFile = {
  version: number;
  users: UserRecord[];
  [key: string]: any;
};

/**
 * Hilfsfunktion: sichert, dass USERS_FILE_ID vorhanden ist,
 * sonst werfen wir einen klaren Fehler.
 */
function getUsersFileId(): string {
  const id = IDS.USERS_FILE_ID;
  if (!id) {
    console.warn("⚠️ Missing IDS.USERS_FILE_ID (VITE_DRIVE_USERS_FILE_ID).");
    throw new Error("USERS_FILE_ID ist nicht konfiguriert.");
  }
  return id;
}

export async function loadUsersFile(): Promise<UsersFile> {
  const fileId = getUsersFileId();
  const raw = await downloadJson<any>(fileId);

  const version =
    typeof raw?.version === "number" && Number.isFinite(raw.version)
      ? raw.version
      : 2;

  const srcUsers: any[] = Array.isArray(raw?.users) ? raw.users : [];

  const users: UserRecord[] = srcUsers.map((u: any): UserRecord => {
    const username = String(u.username ?? "").trim();
    const displayName = String(
      u.displayName ?? u.username ?? ""
    ).trim();
    const password = typeof u.password === "string" ? u.password : "";
    const modules: ModuleKey[] = Array.isArray(u.modules)
      ? (u.modules as string[]).filter(Boolean) as ModuleKey[]
      : [];
    const active =
      typeof u.active === "boolean" ? u.active : true;
    const updatedAt =
      typeof u.updatedAt === "string" ? u.updatedAt : undefined;

    return {
      ...u, // unbekannte Keys bleiben erhalten
      username,
      displayName: displayName || username,
      password,
      modules,
      active,
      updatedAt,
    };
  });

  const file: UsersFile = {
    ...raw,
    version,
    users,
  };

  return file;
}

export async function saveUsersFile(file: UsersFile): Promise<void> {
  const fileId = getUsersFileId();

  const version =
    typeof file.version === "number" && Number.isFinite(file.version)
      ? file.version
      : 2;

  const cleanUsers = (file.users ?? [])
    .map((u) => {
      const username = String(u.username ?? "").trim();
      if (!username) return null;

      const modules: ModuleKey[] = Array.isArray(u.modules)
        ? (u.modules as ModuleKey[]).filter(Boolean)
        : [];

      const active =
        typeof u.active === "boolean" ? u.active : true;

      const base: UserRecord = {
        ...u,
        username,
        displayName: String(u.displayName ?? username).trim(),
        password: typeof u.password === "string" ? u.password : "",
        modules,
        active,
      };

      return base;
    })
    .filter((u): u is UserRecord => u != null);

  const dataToSave: UsersFile = {
    ...file,
    version,
    users: cleanUsers,
  };

  await overwriteJsonContent(fileId, dataToSave as any);
}
