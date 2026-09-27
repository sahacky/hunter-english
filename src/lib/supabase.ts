import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Клиент Supabase. Публичные значения (publishable key) безопасны во фронте,
 * защиту данных даёт Row Level Security (specs/06-db-and-sync.md).
 * Если env не задан — приложение работает офлайн-first без входа.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const isSyncConfigured = supabase !== null
