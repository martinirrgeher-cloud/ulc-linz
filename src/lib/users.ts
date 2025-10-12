// src/lib/users.ts
import { loadJsonByName } from "./googleDrive";
import { hasAccessToken } from "./googleAuth";

export interface User {
  username: string;
  password: string;
  role: "admin" | "trainer" | "athlet";
  modules?: string[];
}

export async function loadUsers(): Promise<User[]> {
  // Token wird bereits vor dem Login geholt
  if (!hasAccessToken()) {
    console.warn("⚠️ Kein Google Token – users.json kann evtl. nicht geladen werden.");
  }
  const data = await loadJsonByName("users.json");
  if (Array.isArray(data)) return data as User[];
  if (data && Array.isArray(data.users)) return data.users as User[];
  console.warn("⚠️ users.json hat ein unerwartetes Format");
  return [];
}

export async function validateUser(username: string, password: string) {
  const users = await loadUsers();
  return users.find(
    (u) => u.username === username && u.password === password
  ) || null;
}
