import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { HunterDb } from './db'
import { loadSettings, saveSettings } from './settings'
import { DEFAULT_SETTINGS } from '../domain/settings/types'
import { uuidv7 } from '../lib/uuidv7'

// Implements: plan://M10#10.1 — хранение настроек в meta-таблице Dexie

let db: HunterDb

beforeEach(() => {
  db = new HunterDb(`hunter-settings-test-${uuidv7()}`)
})

describe('loadSettings / saveSettings', () => {
  it('пустая база → дефолт', async () => {
    expect(await loadSettings(db.meta)).toEqual(DEFAULT_SETTINGS)
  })

  it('roundtrip: сохранение и чтение', async () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      theme: 'light' as const,
      srsButtons: 4 as const,
      newPerDay: 40,
    }
    await saveSettings(db.meta, custom)
    expect(await loadSettings(db.meta)).toEqual(custom)
  })

  it('битые значения нормализуются при чтении', async () => {
    await db.meta.put({ key: 'settings', value: { theme: '???', newPerDay: 999 } }, 'settings')
    const loaded = await loadSettings(db.meta)
    expect(loaded.theme).toBe('dark')
    expect(loaded.newPerDay).toBe(50)
  })
})
