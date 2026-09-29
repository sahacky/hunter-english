// Implements: plan://M13#13.4 — аутентификация Supabase (guest-first).
// Без env — всегда гость; вход: magic link / Google. После login/logout —
// location.reload(): репозитории пересоздаются с активным user_id (db.ts).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase, isSyncConfigured } from '../data/supabase'
import { db, getCurrentUserId, remapLocalToUser, setCurrentUserId } from '../data/db'
import { syncNow } from '../data/sync'

export interface AuthState {
  configured: boolean
  /** null — идёт инициализация (до первого getSession). */
  userId: string | null
  email: string | null
  guest: boolean
  /** Отправка magic link; ошибка — текст для UI. */
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  configured: false,
  userId: null,
  email: null,
  guest: true,
  sendMagicLink: async () => ({ ok: false }),
  signInWithGoogle: async () => ({ ok: false }),
  signOut: async () => undefined,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ userId: string | null; email: string | null }>({
    userId: null,
    email: null,
  })

  useEffect(() => {
    if (!isSyncConfigured()) {
      setState({ userId: getCurrentUserId(), email: null })
      return
    }
    let alive = true
    void (async () => {
      try {
        const supabase = await getSupabase()
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user ?? null
        if (user) await activateUser(user.id, user.email ?? null)
        if (alive)
          setState({ userId: user ? user.id : getCurrentUserId(), email: user?.email ?? null })
        supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            setCurrentUserId('local')
            window.location.reload()
          }
        })
      } catch {
        if (alive) setState({ userId: getCurrentUserId(), email: null })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      configured: isSyncConfigured(),
      userId: state.userId,
      email: state.email,
      guest: state.email === null,
      sendMagicLink: async (email: string) => {
        if (!isSyncConfigured()) return { ok: false, error: 'supabase-not-configured' }
        const supabase = await getSupabase()
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        return error ? { ok: false, error: error.message } : { ok: true }
      },
      signInWithGoogle: async () => {
        if (!isSyncConfigured()) return { ok: false, error: 'supabase-not-configured' }
        const supabase = await getSupabase()
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        return error ? { ok: false, error: error.message } : { ok: true }
      },
      signOut: async () => {
        if (!isSyncConfigured()) return
        const supabase = await getSupabase()
        await supabase.auth.signOut()
        // SIGNED_OUT колбэк делает setCurrentUserId('local') + reload
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Активация вошедшего пользователя: перенос локального прогресса + синк. */
async function activateUser(userId: string, email: string | null): Promise<void> {
  const wasGuest = getCurrentUserId() === 'local'
  await remapLocalToUser(db, userId)
  setCurrentUserId(userId)
  // локальный профиль-заглушка для гостя не нужен на сервере: profiles создаёт
  // триггер; первичная выгрузка ремапнутых строк + pull облачных
  if (wasGuest) await syncNow(db).catch(() => undefined)
  else await syncNow(db).catch(() => undefined)
  void email
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
