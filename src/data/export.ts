// Implements: plan://ux-feedback-2#U.2 — экспорт/импорт прогресса (перенесено из
// SettingsScreen, решение M10#3): Dexie-дамп таблиц прогресса. Общий модуль —
// кнопка «Сохранить прогресс» на дашборде качает тот же файл, что и настройки.
import { db, getCurrentUserId, type HunterDb } from './db'

/** Таблицы прогресса в экспорте (sync_queue — локальная механика, не выгружается). */
export const EXPORT_TABLES = [
  'card_states',
  'review_log',
  'lesson_progress',
  'user_stats',
  'item_progress',
  'disputes',
  'meta',
] as const

export interface ExportPayload {
  app: 'hunter-english'
  export_version: 1
  exported_at: string
  tables: Record<string, unknown[]>
}

export async function buildExportPayload(database: HunterDb = db): Promise<ExportPayload> {
  const tables: Record<string, unknown[]> = {}
  for (const name of EXPORT_TABLES) {
    tables[name] = await database.table(name).toArray()
  }
  return { app: 'hunter-english', export_version: 1, exported_at: new Date().toISOString(), tables }
}

/** Таблицы с user_id: импорт ремапит владельца на локального (MVP — 'local'). */
const USER_ID_TABLES = new Set([
  'card_states',
  'review_log',
  'lesson_progress',
  'user_stats',
  'item_progress',
])

/** Минимальная валидация строк ключевых таблиц (ревью M10 М1): битые поля — отказ импорта целиком. */
function sanitizeImport(payload: ExportPayload): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {}
  for (const name of EXPORT_TABLES) {
    const list = payload.tables[name] ?? []
    if (!Array.isArray(list)) throw new Error(`bad export table: ${name}`)
    result[name] = list.map((row, index) => {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new Error(`bad row in ${name}[${index}]`)
      }
      const record = { ...(row as Record<string, unknown>) }
      // импорт ложится под АКТИВНОГО владельца: гость 'local' или uid после
      // входа (ревью M13 М4 — раньше молча ломал прогресс залогиненного)
      if (USER_ID_TABLES.has(name)) record.user_id = getCurrentUserId()
      if (name === 'card_states') {
        if (typeof record.card_id !== 'string' || typeof record.note_id !== 'string') {
          throw new Error(`bad row in ${name}[${index}]`)
        }
        if (typeof record.due !== 'string' || Number.isNaN(Date.parse(record.due))) {
          throw new Error(`bad due in ${name}[${index}]`)
        }
        if (typeof record.state !== 'number' || record.state < 0 || record.state > 3) {
          throw new Error(`bad state in ${name}[${index}]`)
        }
      }
      if (name === 'review_log') {
        if (typeof record.id !== 'string' || typeof record.card_id !== 'string') {
          throw new Error(`bad row in ${name}[${index}]`)
        }
        if (typeof record.rating !== 'number' || record.rating < 1 || record.rating > 4) {
          throw new Error(`bad rating in ${name}[${index}]`)
        }
      }
      if (name === 'user_stats' && typeof record.xp !== 'number') {
        throw new Error(`bad xp in ${name}[${index}]`)
      }
      if (name === 'lesson_progress' && typeof record.lesson_id !== 'string') {
        throw new Error(`bad row in ${name}[${index}]`)
      }
      if (name === 'item_progress') {
        if (typeof record.item_id !== 'string' || typeof record.kind !== 'string') {
          throw new Error(`bad row in ${name}[${index}]`)
        }
      }
      if (name === 'meta' && typeof record.key !== 'string') {
        throw new Error(`bad row in ${name}[${index}]`)
      }
      return record
    })
  }
  return result
}

export async function importPayload(
  payload: ExportPayload,
  database: HunterDb = db,
): Promise<void> {
  if (payload.app !== 'hunter-english' || payload.export_version !== 1) {
    throw new Error('unsupported export format')
  }
  const rows = sanitizeImport(payload)
  await database.transaction('rw', [...EXPORT_TABLES, 'sync_queue'], async () => {
    for (const name of EXPORT_TABLES) {
      await database.table(name).clear()
      if (rows[name].length > 0) await database.table(name).bulkPut(rows[name])
    }
    await database.sync_queue.clear()
  })
}

/**
 * Скачать файл прогресса (тот же дамп, что экспорт настроек): кнопка
 * «Сохранить прогресс» на дашборде (plan://ux-feedback-2#U.2).
 */
export async function downloadProgressExport(database: HunterDb = db): Promise<ExportPayload> {
  const payload = await buildExportPayload(database)
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `hunter-english-progress-${payload.exported_at.slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  return payload
}
