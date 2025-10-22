import { getAccessToken, tokenExpired, silentRefreshIfNeeded, clearStorage } from '@/lib/googleAuth'

export async function ensureValidToken(): Promise<void> {
  if (!getAccessToken() || tokenExpired()) {
    const ok = await silentRefreshIfNeeded()
    if (!ok) {
      // Redirect zu Login1
      clearStorage()
      window.location.assign('/login1')
      throw new Error('Token abgelaufen – weiterleiten zu Login1')
    }
  } else {
    // Wenn Token knapp ist, auf Verdacht refreshen
    await silentRefreshIfNeeded()
  }
}

// Convenience wrapper, falls gebraucht
export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  await ensureValidToken()
  const token = getAccessToken()
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
