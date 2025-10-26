// src/lib/fetchWithAuth.ts

import { getAccessToken } from "./googleAuth";

/**
 * Führt einen Fetch mit Google OAuth Token aus.
 * Falls kein Token vorhanden ist → sauberer Fehler statt Google 403.
 */
export async function fetchWithAuth(url: string) {
  const token = getAccessToken();

  if (!token) {
    console.error("❌ Kein Google Token vorhanden – nicht authentifiziert.");
    throw new Error("Kein Token – bitte erneut bei Login 1 anmelden.");
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    console.error(`❌ Fehler beim Laden der Datei: ${res.status} ${res.statusText}`);
    throw new Error(`Fehler beim Laden der Datei (Status: ${res.status})`);
  }

  return res;
}
