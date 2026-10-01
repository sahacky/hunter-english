// Implements: plan://M13#13.4 — аутентификация Supabase (guest-first).
// Без env — всегда гость; вход: magic link / Google. После login/logout —
// location.reload(): репозитории пересоздаются с активным user_id (db.ts).
// Фоновые триггеры specs/06 §3 (лайт): flush по 'online', pull каждые 5 мин.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabase, isSyncConfigured } from '../data/supabase'
import { db, getCurrentUserId, remapLocalToUser, setCurrentUserId } from '../data/db'
import { enqueueAllRows, syncNow, trimQueue } from '../data/sync'

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

/** Редирект с учётом подпапки деплоя (GH Pages, ревью M13 М3). */
function appOriginUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ userId: string | null; email: string | null }>({
    userId: null,
    email: null,
  })

  useEffect(() => {
    // долг M13: очередь гостя не растёт бесконечно — трим хвоста при бутстрапе
    void trimQueue(db)
    if (!isSyncConfigured()) {
      // гостю локальный владелец сразу — синхронная инициализация на монтировании
      // eslint-disable-next-line react-hooks/set-state-in-effect -- инициализация гостя без supabase (specs/06 §2)
      setState({ userId: getCurrentUserId(), email: null })
      return
    }
    let alive = true
    void (async () => {
      try {
        const supabase = await getSupabase()
        // подписка ДО долгих операций: события окна первого синка не теряются
        supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            setCurrentUserId('local')
            window.location.reload()
          }
        })
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user ?? null
        if (user) await activateUser(user.id)
        if (alive)
          setState({ userId: user ? user.id : getCurrentUserId(), email: user?.email ?? null })
      } catch {
        if (alive) setState({ userId: getCurrentUserId(), email: null })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // фоновые триггеры (ревью M13 М5, лайт-объём): online → syncNow; период 5 мин
  useEffect(() => {
    if (!isSyncConfigured() || state.email === null) return
    const onOnline = () => void syncNow(db).catch(() => undefined)
    const timer = window.setInterval(() => void syncNow(db).catch(() => undefined), 5 * 60_000)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(timer)
    }
  }, [state.email])

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
          options: { emailRedirectTo: appOriginUrl() },
        })
        return error ? { ok: false, error: error.message } : { ok: true }
      },
      signInWithGoogle: async () => {
        if (!isSyncConfigured()) return { ok: false, error: 'supabase-not-configured' }
        const supabase = await getSupabase()
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: appOriginUrl() },
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

/**
 * Активация вошедшего пользователя: перенос локального прогресса (гость → uid),
 * полная постановка строк в очередь (у гостя очередь могла не вестись/быть
 * частичной — дедуп flush по conflict-key разрулит), затем push+pull.
 */
async function activateUser(userId: string): Promise<void> {
  const wasGuest = getCurrentUserId() === 'local'
  await remapLocalToUser(db, userId)
  setCurrentUserId(userId)
  if (wasGuest) await enqueueAllRows(db)
  await syncNow(db).catch(() => undefined)
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
