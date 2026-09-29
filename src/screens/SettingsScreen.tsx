// Implements: plan://M10#10.2 — экран настроек /#/settings (specs/07 §2.1, MVP-объём).
// Экспорт/импорт — Dexie-дамп таблиц прогресса (решение M10#3); сброс — с подтверждением.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db, HunterDb, getCurrentUserId } from '../data/db'
import { useSettings } from '../state/settings'
import type { Locale, SrsButtonMode, ThemeChoice, TtsRate } from '../domain/settings/types'
import { showToast } from '../lib/toast'
import { useAuth } from '../state/auth'
import { readSyncStatus, syncNow, type SyncStatus } from '../data/sync'

/** Таблицы прогресса в экспорте (sync_queue — локальная механика, не выгружается). */
const EXPORT_TABLES = [
  'card_states',
  'review_log',
  'lesson_progress',
  'user_stats',
  'item_progress',
  'disputes',
  'meta',
] as const

/** Сброс: прогресс удаляется, настройки (meta) сохраняются. */
const RESET_TABLES = [
  'card_states',
  'review_log',
  'lesson_progress',
  'user_stats',
  'item_progress',
  'disputes',
  'sync_queue',
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

interface SettingsScreenProps {
  /** Инъекция для тестов. */
  database?: HunterDb
}

export default function SettingsScreen({ database }: SettingsScreenProps) {
  const { t } = useTranslation()
  const { settings, update, ready } = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newPerDayDraft, setNewPerDayDraft] = useState(String(settings.newPerDay))
  const auth = useAuth()
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)

  useEffect(() => {
    void readSyncStatus(database ?? db)
      .then(setSync)
      .catch(() => undefined)
  }, [database])
  const dbName = useMemo(() => database?.name ?? 'local', [database])

  // внешний источник изменения (импорт/сброс дефолтов) синхронизирует черновик
  useEffect(() => {
    setNewPerDayDraft(String(settings.newPerDay))
  }, [settings.newPerDay])

  /** Перезагрузка после тоста, чтобы пользователь увидел результат (ревью M10 м1). */
  const reloadWithToast = (message: string) => {
    showToast(message)
    window.setTimeout(() => window.location.reload(), 600)
  }

  const exportProgress = async () => {
    setBusy(true)
    try {
      const payload = await buildExportPayload(database ?? db)
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `hunter-english-progress-${payload.exported_at.slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  const importProgress = async (file: File) => {
    setBusy(true)
    try {
      const payload = JSON.parse(await file.text()) as ExportPayload
      await importPayload(payload, database ?? db)
      // настройки могли приехать в дампе — перезагружаем страницу целиком,
      // чтобы провайдер и экраны прочитали новое состояние
      reloadWithToast(t('settings.data.importDone'))
    } catch {
      showToast(t('settings.data.importFailed'))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const resetProgress = async () => {
    setBusy(true)
    try {
      await (database ?? db).transaction('rw', [...RESET_TABLES], async () => {
        for (const name of RESET_TABLES) await (database ?? db).table(name).clear()
      })
      setConfirmReset(false)
      reloadWithToast(t('settings.data.resetDone'))
    } catch {
      showToast(t('settings.data.resetFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <section className="panel">
        <p className="dim">{t('common.loading')}</p>
      </section>
    )
  }

  return (
    <div className="settings">
      <section className="panel">
        <h2>{t('settings.appearance.title')}</h2>
        <label className="settings-row">
          <span>{t('settings.appearance.theme')}</span>
          <select
            value={settings.theme}
            onChange={(event) => update({ theme: event.target.value as ThemeChoice })}
          >
            <option value="dark">{t('settings.appearance.themeDark')}</option>
            <option value="light">{t('settings.appearance.themeLight')}</option>
            <option value="system">{t('settings.appearance.themeSystem')}</option>
          </select>
        </label>
        <label className="settings-row">
          <span>{t('settings.appearance.locale')}</span>
          <select
            value={settings.locale}
            onChange={(event) => update({ locale: event.target.value as Locale })}
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="settings-row">
          <span>{t('settings.appearance.animations')}</span>
          <select
            value={settings.animations}
            onChange={(event) => update({ animations: event.target.value as 'on' | 'off' })}
          >
            <option value="on">{t('settings.common.on')}</option>
            <option value="off">{t('settings.common.off')}</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>{t('settings.srs.title')}</h2>
        <label className="settings-row">
          <span>{t('settings.srs.newPerDay')}</span>
          <input
            type="number"
            min={5}
            max={50}
            value={newPerDayDraft}
            onChange={(event) => setNewPerDayDraft(event.target.value)}
            onBlur={() => update({ newPerDay: Number(newPerDayDraft) })}
          />
        </label>
        <label className="settings-row">
          <span>{t('settings.srs.buttons')}</span>
          <select
            value={settings.srsButtons}
            onChange={(event) =>
              update({ srsButtons: Number(event.target.value) as SrsButtonMode })
            }
          >
            <option value={2}>{t('settings.srs.buttons2')}</option>
            <option value={4}>{t('settings.srs.buttons4')}</option>
          </select>
        </label>
        <label className="settings-row">
          <span>{t('settings.srs.intervals')}</span>
          <select
            value={settings.showIntervals ? 'on' : 'off'}
            onChange={(event) => update({ showIntervals: event.target.value === 'on' })}
          >
            <option value="off">{t('settings.common.off')}</option>
            <option value="on">{t('settings.common.on')}</option>
          </select>
        </label>
        <p className="dim settings-note">{t('settings.srs.note')}</p>
      </section>

      <section className="panel">
        <h2>{t('settings.voice.title')}</h2>
        <label className="settings-row">
          <span>{t('settings.voice.rate')}</span>
          <select
            value={settings.ttsRate}
            onChange={(event) => update({ ttsRate: Number(event.target.value) as TtsRate })}
          >
            <option value={1}>1×</option>
            <option value={0.75}>0.75×</option>
          </select>
        </label>
        <p className="dim settings-note">{t('settings.voice.note')}</p>
      </section>

      <section className="panel">
        <h2>{t('settings.account.title')}</h2>
        <p className="dim">
          {auth.guest
            ? t('settings.account.guest')
            : t('settings.account.signedIn', { email: auth.email ?? '' })}
        </p>
        <div className="settings-row settings-actions">
          {auth.guest ? (
            <a className="srs-btn" href="#/login">
              {t('settings.account.signIn')}
            </a>
          ) : (
            <button type="button" className="srs-btn" onClick={() => void auth.signOut()}>
              {t('settings.account.signOut')}
            </button>
          )}
          {sync?.configured && !auth.guest && (
            <button
              type="button"
              className="srs-btn"
              disabled={syncBusy}
              onClick={() => {
                setSyncBusy(true)
                void syncNow(database ?? db)
                  .then(() => readSyncStatus(database ?? db))
                  .then(setSync)
                  .catch(() => undefined)
                  .finally(() => setSyncBusy(false))
              }}
            >
              {t('settings.account.syncNow')}
            </button>
          )}
        </div>
        {sync && !auth.guest && (
          <p className="dim settings-note">
            {t('settings.account.queue', { count: sync.queue })} ·{' '}
            {sync.failed > 0 ? t('settings.account.failed', { count: sync.failed }) + ' · ' : ''}
            {sync.lastSyncAt
              ? t('settings.account.lastSync', {
                  time: new Date(sync.lastSyncAt).toLocaleString(),
                })
              : t('settings.account.neverSynced')}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>{t('settings.data.title')}</h2>
        <div className="settings-row settings-actions">
          <button
            type="button"
            className="srs-btn"
            disabled={busy}
            onClick={() => void exportProgress()}
          >
            {t('settings.data.export')}
          </button>
          <button
            type="button"
            className="srs-btn"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {t('settings.data.import')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="settings-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importProgress(file)
            }}
          />
        </div>
        <div className="settings-row settings-actions">
          {confirmReset ? (
            <>
              <span className="srs-error">{t('settings.data.resetConfirm')}</span>
              <button
                type="button"
                className="srs-btn srs-btn-again"
                disabled={busy}
                onClick={() => void resetProgress()}
              >
                {t('settings.data.resetYes')}
              </button>
              <button type="button" className="srs-btn" onClick={() => setConfirmReset(false)}>
                {t('settings.data.resetNo')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="srs-btn srs-btn-again"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
            >
              {t('settings.data.reset')}
            </button>
          )}
        </div>
        <p className="dim settings-note">{t('settings.data.note', { db: dbName })}</p>
      </section>
    </div>
  )
}
