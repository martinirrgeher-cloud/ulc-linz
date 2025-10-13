// src/lib/auth.js
import { initGoogleAuth, signInWithGoogle } from "./googleAuth";
import { loadJsonByName } from "./googleDrive";

const USERS_FILE = import.meta.env.VITE_USERS_FILE || "users.json";

/**
 * users.json – erwartetes Format:
 * {
 *   "users": [
 *     { "username": "admin", "password": "admin", "modules": ["Kindertraining","U12","U14","Leistungsgruppe","Übungskatalog"] },
 *     { "username": "trainerA", "password": "xyz", "modules": ["Kindertraining"] }
 *   ]
 * }
 */

export async function loginWithCredentials(username, password) {
  // 1) GIS Token holen (Popup per Button-Klick-Handler)
  initGoogleAuth();
  await signInWithGoogle();

  // 2) users.json vom Drive laden
  const usersDoc = await loadJsonByName(USERS_FILE);
  if (!usersDoc || !Array.isArray(usersDoc.users)) {
    throw new Error("Benutzerdaten konnten nicht geladen werden (users.json fehlt oder ist leer).");
  }

  // 3) prüfen
  const found = usersDoc.users.find(u => u.username === username);
  if (!found || found.password !== password) {
    throw new Error("Benutzername oder Passwort falsch.");
  }

  // 4) Session im Speicher halten (optional)
  const session = { username: found.username, modules: found.modules || [] };
  localStorage.setItem("ulc_session", JSON.stringify(session));
  return session;
}

export function getSession() {
  const raw = localStorage.getItem("ulc_session");
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem("ulc_session");
}
