import { getAccessToken } from "@/lib/googleAuth";

const USERS_FILE_ID = import.meta.env.VITE_USERS_FILE_ID;

export async function fetchUsersAndLogin(username: string, password: string) {
  const token = getAccessToken();
  if (!token) return null;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${USERS_FILE_ID}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Fehler beim Laden der users.json");

  const json = await res.json();

  // ✅ korrekt auf das users-Array zugreifen
  const users = Array.isArray(json) ? json : json.users;

  if (!Array.isArray(users)) {
    console.error("users.json hat ein ungültiges Format", json);
    return null;
  }

  // ✅ Benutzername & Passwort prüfen
  const user = users.find(
    (u: any) => u.username === username && u.password === password
  );

  return user || null;
}
