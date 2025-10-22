import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { downloadJson } from '@/lib/DriveClient'
import useTokenRefresh from '@/hooks/useTokenRefresh'
import {
  loadFromStorage, saveToStorage, clearStorage,
  getAccessToken, signInWithGooglePopup, signOutGoogle,
  tokenExpired, getStoredUser
} from '@/lib/googleAuth'

type User = { username: string }
type AuthState = { googleToken: string | null; user: User | null }

type AuthContextType = {
  state: AuthState
  loginGoogle: () => Promise<void>
  login2: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    const s = loadFromStorage()
    return { googleToken: s.googleToken, user: s.user }
  })

  // Silent refresh heartbeat
  useTokenRefresh()

  // Auto-Login2 (persistenter Benutzer): Wenn User vorhanden und Token gültig → direkt angemeldet
  useEffect(() => {
    const storedUser = getStoredUser()
    if (!state.user && storedUser && getAccessToken() && !tokenExpired()) {
      setState(s => ({ ...s, user: storedUser }))
    }
  }, [])

  const loginGoogle = async () => {
    const token = await signInWithGooglePopup()
    setState(s => ({ ...s, googleToken: token }))
  }

  const login2 = async (username: string, password: string) => {
    const usersFileId = import.meta.env.VITE_USERS_FILE_ID as string | undefined
    let valid = false

    if (usersFileId) {
      const users = await downloadJson(usersFileId)
      const u = Array.isArray(users) ? users.find((x: any) => x.username === username) : users?.users?.find((x: any) => x.username === username)
      if (u && typeof u.password === 'string') valid = u.password === password
    } else {
      // DEV: jedes nicht-leere Passwort zulassen
      const DEV = import.meta.env.VITE_DEV_BYPASS === '1'
      if (DEV) valid = password.length > 0
    }

    if (!valid) throw new Error('Benutzername oder Passwort ist falsch.')

    const user = { username }
    const newState = { googleToken: getAccessToken(), user }
    setState(newState); saveToStorage({ ...loadFromStorage(), ...newState })
  }

  const logout = async () => {
    await signOutGoogle()
    setState({ googleToken: null, user: null })
    clearStorage()
    window.location.assign('/login1')
  }

  const switchUser = async () => {
    // Nur User löschen (Token behalten) → zurück zu Login2
    const token = getAccessToken()
    setState({ googleToken: token, user: null })
    saveToStorage({ ...loadFromStorage(), googleToken: token, user: null })
    window.location.assign('/login2')
  }

  const value = useMemo(() => ({ state, loginGoogle, login2, logout, switchUser }), [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
