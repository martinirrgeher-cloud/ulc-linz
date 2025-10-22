import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUsers } from '../lib/users'
import '@/styles/login.css'

export default function Login2() {
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  const handleLogin = async () => {
    setBusy(true)
    setError(null)
    try {
      const users = await fetchUsers()
      const match = users.find(
        (u: any) => u.username === username && u.password === password
      )
      if (!match) {
        setError('Benutzername oder Passwort ist falsch.')
        setBusy(false)
        return
      }
      localStorage.setItem('user', JSON.stringify(match))
      nav('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <img src="/logo.png" alt="ULC Linz Logo" className="login-logo" />
        <h1 className="login-title">Login 2</h1>

        <input
          ref={userRef}
          placeholder="Benutzername"
          className="login-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter') passRef.current?.focus()
          }}
        />
        <input
          ref={passRef}
          type="password"
          placeholder="Passwort"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter') handleLogin()
          }}
        />

        {error && <div className="login-error">{error}</div>}

        <button
          className="login-button"
          onClick={handleLogin}
          disabled={busy}
        >
          {busy ? 'Anmeldung läuft…' : 'Anmelden'}
        </button>
      </div>
    </div>
  )
}
