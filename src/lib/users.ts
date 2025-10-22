// src/lib/users.ts
import { getAccessToken } from './googleAuth'

const USERS_FILE_ID = import.meta.env.VITE_USERS_FILE_ID as string

/**
 * Lädt die Benutzerliste von Google Drive (users.json)
 * Erwartete Struktur:
 * {
 *   "users": [
 *     { "username": "admin", "password": "admin", "modules": [...] },
 *     ...
 *   ]
 * }
 */
export async function fetchUsers(): Promise<any[]> {
  const token = getAccessToken()
  if (!token) throw new Error('Kein Google Token – bitte neu anmelden.')

  const url = `https://www.googleapis.com/drive/v3/files/${USERS_FILE_ID}?alt=media`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Fehler beim Laden der Benutzerdaten (${res.status})`)
  }

  const json = await res.json()
  if (!json || !Array.isArray(json.users)) {
    throw new Error('Ungültige Struktur in users.json')
  }

  return json.users
}
