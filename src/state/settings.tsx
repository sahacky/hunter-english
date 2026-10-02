// Implements: plan://M10#10.1 — провайдер настроек: загрузка/сохранение (Dexie meta),
// применение темы/локали/скорости TTS/анимаций. Контекст с дефолтом — экраны
// работают и без провайдера (тесты).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import i18n from '../i18n'
import { db } from '../data/db'
import { loadSettings, saveSettings } from '../data/settings'
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveTheme,
  type Settings,
} from '../domain/settings/types'
import { setDefaultRate } from '../lib/tts'

interface SettingsContextValue {
  settings: Settings
  ready: boolean
  /** Частичное обновление: нормализация + сохранение + применение. */
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  ready: false,
  update: () => undefined,
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void loadSettings(db.meta)
      .then((value) => {
        if (alive) setSettings(value)
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // Тема: выбор пользователя + системное предпочтение (specs/08 §2.2).
  // Зеркалим в localStorage для анти-FOUC-скрипта в index.html и обновляем
  // meta theme-color (статус-бар PWA следует за темой — ревью M10 м5)
  useEffect(() => {
    const apply = (prefersDark: boolean) => {
      const resolved = resolveTheme(settings.theme, prefersDark)
      document.documentElement.dataset.theme = resolved
      try {
        window.localStorage.setItem('he-theme', resolved)
      } catch {
        // приватный режим — FOUC-скрипт просто не найдёт зеркало
      }
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'light' ? '#f6f8f4' : '#17211c')
    }
    apply(window.matchMedia('(prefers-color-scheme: dark)').matches)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  // Локаль интерфейса
  useEffect(() => {
    if (i18n.language !== settings.locale) void i18n.changeLanguage(settings.locale)
    document.documentElement.lang = settings.locale
  }, [settings.locale])

  // Скорость озвучки по умолчанию
  useEffect(() => {
    setDefaultRate(settings.ttsRate)
  }, [settings.ttsRate])

  // Анимации: off — гасим CSS-анимации на корне ( reduced-motion уважается всегда)
  useEffect(() => {
    if (settings.animations === 'off') document.documentElement.dataset.animations = 'off'
    else delete document.documentElement.dataset.animations
  }, [settings.animations])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...patch })
      void saveSettings(db.meta, next).catch(() => undefined)
      return next
    })
  }, [])

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext)
}
