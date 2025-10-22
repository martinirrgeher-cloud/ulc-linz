import { useEffect } from 'react'
import { silentRefreshIfNeeded, getAccessToken } from '@/lib/googleAuth'/**
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
    const tick = () => { if (shouldRun()) silentRefreshIfNeeded().catch(() => {}) }
    const start = setTimeout(tick, 5000)          // 5s nach Mount
    const id = setInterval(tick, 3 * 60 * 1000)   // alle 3 Minuten
    return () => { clearTimeout(start); clearInterval(id) }
  }, [])
}
