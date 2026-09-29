// Implements: plan://M10#10.2 — экран настроек /#/settings (specs/07 §2.1, MVP-объём).
// Экспорт/импорт — Dexie-дамп таблиц прогресса (решение M10#3); сброс — с подтверждением.
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db, HunterDb } from '../data/db'
import { useSettings } from '../state/settings'
import type { Locale, SrsButtonMode, ThemeChoice, TtsRate } from '../domain/settings/types'
import { showToast } from '../lib/toast'

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
  await database.transaction('rw', [...EXPORT_TABLES, 'sync_queue'], async () => {
    for (const name of EXPORT_TABLES) {
      await database.table(name).clear()
      const rows = payload.tables[name] ?? []
      if (rows.length > 0) await database.table(name).bulkPut(rows)
    }
    await database.sync_queue.clear()
  })
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
  const dbName = useMemo(() => database?.name ?? 'local', [database])

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
      showToast(t('settings.data.importDone'))
      window.location.reload()
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
      showToast(t('settings.data.resetDone'))
      window.location.reload()
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
            value={settings.newPerDay}
            onChange={(event) => update({ newPerDay: Number(event.target.value) })}
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
