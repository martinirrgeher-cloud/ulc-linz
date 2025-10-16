// src/lib/users.ts
import { loadJsonByName } from "../lib/googleDrive";

export interface UserData {
  username: string;
  password: string;
  modules: string[];
  role?: string;
}

function isUserData(x: any): x is UserData {
  return !!x && typeof x.username === "string" && typeof x.password === "string" && Array.isArray(x.modules);
}

export async function loadUsers(): Promise<UserData[]> {
  const data = await loadJsonByName("users.json");
  if (!data) throw new Error("users.json nicht gefunden");

  // Direkt mit dem Ergebnis arbeiten, kein JSON.parse()
  if (Array.isArray(data)) {
    return (data as any[]).filter(isUserData);
  }
  if (Array.isArray((data as any).users)) {
    return (data as any).users.filter(isUserData);
  }

  console.error("users.json hat kein erwartetes Format:", data);
  throw new Error("users.json hat kein erwartetes Format (Array oder {users:[]}).");
}

export async function validateUser(username: string, password: string): Promise<UserData | null> {
  const users = await loadUsers();
  return users.find(u => u.username === username && u.password === password) || null;
}
