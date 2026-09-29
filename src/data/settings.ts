// Implements: plan://M10#10.1 — хранение настроек в meta-таблице Dexie (specs/06 §3).
import type { Table } from 'dexie'
import type { MetaRow } from './db'
import { normalizeSettings, type Settings } from '../domain/settings/types'

const KEY = 'settings'

/** Читает настройки; отсутствующие/битые — дефолт (normalize). */
export async function loadSettings(meta: Table<MetaRow, string>): Promise<Settings> {
  const row = await meta.get(KEY)
  return normalizeSettings((row?.value as Partial<Settings>) ?? null)
}

/** Сохраняет настройки (upsert). */
export async function saveSettings(
  meta: Table<MetaRow, string>,
  settings: Settings,
): Promise<void> {
  await meta.put({ key: KEY, value: settings }, KEY)
}
