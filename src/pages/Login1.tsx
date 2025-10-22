import { useEffect, useState } from 'react'
import { initGoogleAuth, requestAccessToken, isLoggedIn } from '@/lib/googleAuth'
import { useNavigate } from 'react-router-dom'
import '@/styles/login.css'

export default function Login1() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    initGoogleAuth()
    if (isLoggedIn()) nav('/login2', { replace: true })
  }, [nav])

  const handleLogin = async () => {
    if (busy) return
    setBusy(true)
    try {
      await requestAccessToken({ prompt: 'consent' })
      nav('/login2', { replace: true })
    } catch (e) {
      console.error(e)
      setBusy(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/logo.png" alt="ULC Linz Logo" className="login-logo" />
        <h1 className="login-title">Login 1</h1>
        <button className="login-button" onClick={handleLogin} disabled={busy}>
          {busy ? 'Bitte warten…' : 'Mit Google anmelden'}
        </button>
      </div>
    </div>
  )
}
