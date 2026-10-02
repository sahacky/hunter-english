// Implements: plan://M10#10.1 — домен настроек (specs/07 §2.1, MVP-объём).
// Чистые типы и дефолты; хранение — src/data/settings.ts, применение — SettingsProvider.

export type ThemeChoice = 'dark' | 'light' | 'system'
export type Locale = 'ru' | 'en'
export type SrsButtonMode = 2 | 4
export type TtsRate = 1 | 0.75

export interface Settings {
  /** Тема оформления (system — следует ОС через matchMedia). */
  theme: ThemeChoice
  /** Локаль интерфейса (учебный контент не зависит). */
  locale: Locale
  /** Режим кнопок SRS: 2 (Вспомнил/Не вспомнил) или 4 (specs/03 §6). */
  srsButtons: SrsButtonMode
  /** Показывать следующий интервал на кнопках SRS (specs/03 §6). */
  showIntervals: boolean
  /** Дневной лимит новых карточек, 5–50 (srs://rule-3). */
  newPerDay: number
  /** Скорость озвучки по умолчанию (обычная кнопка 🔊). */
  ttsRate: TtsRate
  /** Анимации (волна микрофона и пр.); off — уважает и prefers-reduced-motion. */
  animations: 'on' | 'off'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light', // Daylight — светлая по умолчанию (plan://theme-daylight#D.2)
  locale: 'ru',
  srsButtons: 2,
  showIntervals: false,
  newPerDay: 15,
  ttsRate: 1,
  animations: 'on',
}

const THEMES: ThemeChoice[] = ['dark', 'light', 'system']
const LOCALES: Locale[] = ['ru', 'en']

/** Клампит/нормализует значения после импорта или частичного обновления. */
export function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  const raw = value ?? {}
  const newPerDay =
    typeof raw.newPerDay === 'number' ? Math.round(raw.newPerDay) : DEFAULT_SETTINGS.newPerDay
  return {
    theme: THEMES.includes(raw.theme as ThemeChoice)
      ? (raw.theme as ThemeChoice)
      : DEFAULT_SETTINGS.theme,
    locale: LOCALES.includes(raw.locale as Locale)
      ? (raw.locale as Locale)
      : DEFAULT_SETTINGS.locale,
    srsButtons: raw.srsButtons === 4 ? 4 : 2,
    showIntervals:
      typeof raw.showIntervals === 'boolean' ? raw.showIntervals : DEFAULT_SETTINGS.showIntervals,
    newPerDay: Math.min(
      50,
      Math.max(5, Number.isFinite(newPerDay) ? newPerDay : DEFAULT_SETTINGS.newPerDay),
    ),
    ttsRate: raw.ttsRate === 0.75 ? 0.75 : 1,
    animations: raw.animations === 'off' ? 'off' : 'on',
  }
}

/** Тема для применения: system разрешается через prefers-color-scheme. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): 'dark' | 'light' {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}
