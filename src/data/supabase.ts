// Implements: plan://M13#13.2 — клиент Supabase за env-гейтом (specs/06 §0).
// Гостевой режим (без env) не грузит библиотеку: lazy dynamic import.
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Синхронизация доступна (обе переменные заданы). */
export function isSyncConfigured(): boolean {
  return Boolean(url && publishableKey)
}

let clientPromise: Promise<SupabaseClient> | null = null

/** Единственный клиент приложения; null-режим отсутствия env исключён вызовом isSyncConfigured. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isSyncConfigured()) {
    return Promise.reject(new Error('supabase-not-configured'))
  }
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return clientPromise
}
