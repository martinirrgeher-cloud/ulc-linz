import { getValidAccessToken } from "@/lib/googleAuth";

// ✅ Laufzeitprüfung direkt beim Laden der Datei
const USERS_FILE_ID = import.meta.env.VITE_DRIVE_USERS_FILE_ID;

console.log("🔹 USERS_FILE_ID (Laufzeitprüfung):", USERS_FILE_ID);

if (!USERS_FILE_ID) {
  console.error("❌ USERS_FILE_ID ist nicht definiert. Prüfe .env und Server-Neustart!");
  throw new Error("USERS_FILE_ID fehlt");
}

/**
 * Lädt users.json aus Google Drive und prüft Login-Daten
 * @param username Benutzername
 * @param password Passwort
 * @returns user-Objekt oder null bei Fehler
 */
export async function fetchUsersAndLogin(username: string, password: string) {
  const token = getValidAccessToken();

  if (!token) {
    console.error("❌ Kein Google-Token vorhanden. Login 1 wurde vermutlich nicht durchgeführt.");
    return null;
  }

  const url = `https://www.googleapis.com/drive/v3/files/${USERS_FILE_ID}?alt=media`;
  console.log("🌐 fetchUsersAndLogin → URL:", url);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error(`❌ Fehler beim Laden der users.json (Status: ${res.status})`);
    throw new Error("Fehler beim Laden der users.json");
  }

  const json = await res.json();
  const users = Array.isArray(json) ? json : json.users;

  if (!Array.isArray(users)) {
    console.error("❌ users.json hat ein ungültiges Format:", json);
    return null;
  }

  const user = users.find(
    (u: any) => u.username === username && u.password === password
  );

  if (!user) {
    console.warn(`⚠️ Benutzer '${username}' nicht gefunden oder falsches Passwort.`);
  }

  return user || null;
}
