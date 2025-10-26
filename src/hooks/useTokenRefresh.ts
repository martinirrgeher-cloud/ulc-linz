import { useEffect } from 'react'
import { getAccessToken, silentRefreshIfNeeded } from '@/lib/googleAuth'

/**
 * Führt regelmäßig einen Best-Effort Silent-Refresh aus.
 * Läuft NICHT auf Login-Seiten und nie parallel zum aktiven Login.
 */
export default function useTokenRefresh() {
  useEffect(() => {
    const shouldRun = () => {
      const path = window.location.pathname
      if (path.startsWith('/login')) return false
      if (!getAccessToken()) return false
      return true
    }
    const interval = setInterval(() => {
      if (shouldRun()) {
        silentRefreshIfNeeded().catch((err) =>
          console.error('[TokenRefresh] Silent refresh fehlgeschlagen', err)
        )
      }
    }, 10 * 60 * 1000) // alle 10 Minuten

    return () => clearInterval(interval)
  }, [])
}
