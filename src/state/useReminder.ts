// Implements: plan://audit-2026-10-08#W1 — напоминание о занятии.
// Локальное (без сервера/push): пока вкладка открыта, в заданное время один
// раз в день показываем Web Notification. Чистая функция due — для тестов.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from './settings'

const LAST_DAY_KEY = 'he-reminder-day'

/** Ключ дня (локальная дата, YYYY-MM-DD) — напоминание срабатывает раз в день. */
function dayKey(now: Date): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** Настало ли время напоминания (и сегодня ещё не показывали). */
export function reminderDue(
  now: Date,
  reminderTime: string | null,
  lastShownDay: string | null,
): boolean {
  if (!reminderTime) return false
  const today = dayKey(now)
  if (lastShownDay === today) return false
  const [h, m] = reminderTime.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  const due = new Date(now)
  due.setHours(h!, m!, 0, 0)
  return now.getTime() >= due.getTime()
}

/** Показать уведомление (если API доступен и разрешено) и записать день. */
function fireReminder(title: string, body: string, now: Date): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    // окружение без Notification (jsdom/старые браузеры) — день всё равно
    // засчитываем, чтобы не пытаться каждую минуту
  }
  try {
    localStorage.setItem(LAST_DAY_KEY, dayKey(now))
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

/** Хук: раз в минуту проверяет время; вызывается из App (внутри SettingsProvider). */
export function useReminder(): void {
  const { t } = useTranslation()
  const { settings } = useSettings()
  useEffect(() => {
    if (!settings.reminderTime) return
    const tick = () => {
      let last: string | null = null
      try {
        last = localStorage.getItem(LAST_DAY_KEY)
      } catch {
        /* istanbul ignore next @preserve — приватный режим: getItem кидает */
        last = null
      }
      if (reminderDue(new Date(), settings.reminderTime, last)) {
        fireReminder(
          t('settings.reminder.notifyTitle'),
          t('settings.reminder.notifyBody'),
          new Date(),
        )
      }
    }
    tick()
    const timer = window.setInterval(tick, 60_000)
    return () => window.clearInterval(timer)
  }, [settings.reminderTime, t])
}
