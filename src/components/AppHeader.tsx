import { useAuth } from '@/store/AuthContext'

export default function AppHeader() {
  const { state, logout, switchUser } = useAuth()

  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="container-mobile py-2 flex items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          {state.user ? <>Angemeldet als <span className="font-medium">{state.user.username}</span></> : 'Nicht angemeldet'}
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-xl border text-sm" onClick={() => switchUser()}>
            Benutzer wechseln
          </button>
          <button className="px-3 py-1 rounded-xl bg-black text-white text-sm" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
