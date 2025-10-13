// src/lib/users.ts
import { loadJsonByName } from "./googleDrive";

export interface UserData {
  username: string;
  password: string;
  modules: string[];
  role?: string;
}

function isUserData(x: any): x is UserData {
  return (
    x &&
    typeof x.username === "string" &&
    typeof x.password === "string" &&
    Array.isArray(x.modules) &&
    x.modules.every((m: any) => typeof m === "string")
  );
}

export async function loadUsers(): Promise<UserData[]> {
  let data: any;
  try {
    data = await loadJsonByName("users.json");
  } catch (err: any) {
    console.error(`users.json konnte nicht geladen werden: ${err?.message || err}`);
    throw new Error("users.json nicht ladbar (siehe Konsole).");
  }
  if (!Array.isArray(data)) {
    console.error("users.json hat kein erwartetes Format (Array). Tatsächlicher Typ:", typeof data, data);
    throw new Error("users.json hat kein erwartetes Format (Array).");
  }
  const invalid = data.filter((u) => !isUserData(u));
  if (invalid.length > 0) {
    console.error("Ungültige Benutzerobjekte in users.json:", invalid);
    throw new Error("users.json enthält ungültige Benutzerobjekte (siehe Konsole).");
  }
  return data as UserData[];
}

export async function validateUser(username: string, password: string): Promise<UserData | null> {
  const users = await loadUsers();
  return users.find((u) => u.username === username && u.password === password) || null;
}
