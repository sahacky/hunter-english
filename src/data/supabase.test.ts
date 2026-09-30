// Implements: plan://M19 — покрытие env-гейта Supabase-клиента.
// import.meta.env читается при загрузке модуля — каждый тест импортирует
// свежую копию после stubEnv/resetModules.
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('supabase env-гейт (specs/06 §0)', () => {
  it('без env: isSyncConfigured=false, getSupabase отказывает', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    const { isSyncConfigured, getSupabase } = await import('./supabase')
    expect(isSyncConfigured()).toBe(false)
    await expect(getSupabase()).rejects.toThrow('supabase-not-configured')
  })

  it('с env: клиент создаётся и кэшируется (один промис)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key')
    const { isSyncConfigured, getSupabase } = await import('./supabase')
    expect(isSyncConfigured()).toBe(true)
    const first = getSupabase()
    const second = getSupabase()
    expect(first).toBe(second)
    const client = await first
    expect(client).toBeTruthy()
  })
})
