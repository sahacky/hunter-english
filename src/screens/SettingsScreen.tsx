// Implements: plan://M10#10.2 — экран настроек /#/settings (specs/07 §2.1, MVP-объём).
// Экспорт/импорт — Dexie-дамп таблиц прогресса (решение M10#3, логика в src/data/export.ts);
// сброс — с подтверждением.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db, HunterDb } from '../data/db'
import { downloadProgressExport, importPayload, type ExportPayload } from '../data/export'
import { useSettings } from '../state/settings'
import type { Locale, SrsButtonMode, ThemeChoice, TtsRate } from '../domain/settings/types'
import { showToast } from '../lib/toast'
import { useAuth } from '../state/auth'
import { readSyncStatus, syncNow, type SyncStatus } from '../data/sync'

// Переэкспорт ради стабильности импорта тестов (логика переехала в data/export)
export { buildExportPayload, importPayload } from '../data/export'
export type { ExportPayload } from '../data/export'

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

  // внешний источник изменения (импорт/сброс дефолтов) синхронизирует черновик;
  // ресет черновика по изменению пропа — осознанный паттерн «adjust state on change»
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ресет черновика при внешнем изменении newPerDay
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
      await downloadProgressExport(database ?? db)
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
        <p className="dim">{t('settings.srs.wordsCapHint')}</p>
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
        <h2>{t('settings.reminder.title')}</h2>
        <label className="settings-row">
          <span>{t('settings.reminder.time')}</span>
          <input
            type="time"
            value={settings.reminderTime ?? ''}
            onChange={(event) => {
              const value = event.target.value || null
              update({ reminderTime: value })
              if (
                value &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'default'
              ) {
                void Notification.requestPermission()
              }
            }}
          />
        </label>
        {settings.reminderTime && (
          <button type="button" className="srs-btn" onClick={() => update({ reminderTime: null })}>
            {t('settings.reminder.off')}
          </button>
        )}
        <p className="dim settings-note">{t('settings.reminder.hint')}</p>
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
