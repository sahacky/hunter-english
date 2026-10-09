import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings, resolveTheme, type Settings } from './types'

// Implements: plan://M10#10.1 — нормализация/клампы настроек

describe('normalizeSettings', () => {
  it('пустой ввод → дефолты', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('валидные значения сохраняются', () => {
    const value: Partial<Settings> = {
      theme: 'light',
      locale: 'en',
      srsButtons: 4,
      showIntervals: true,
      newPerDay: 30,
      ttsRate: 0.75,
      animations: 'off',
      reminderTime: null,
    }
    expect(normalizeSettings(value)).toEqual(value)
  })

  it('newPerDay клампится в 5–50, не-число → дефолт', () => {
    expect(normalizeSettings({ newPerDay: 2 }).newPerDay).toBe(5)
    expect(normalizeSettings({ newPerDay: 999 }).newPerDay).toBe(50)
    expect(normalizeSettings({ newPerDay: 15.6 }).newPerDay).toBe(16)
    expect(normalizeSettings({ newPerDay: Number.NaN }).newPerDay).toBe(15)
  })

  it('невалидные enum → дефолт', () => {
    const result = normalizeSettings({
      theme: 'neon' as never,
      locale: 'de' as never,
      srsButtons: 3 as never,
      ttsRate: 0.5 as never,
      animations: 'maybe' as never,
    })
    expect(result.theme).toBe('light')
    expect(result.locale).toBe('ru')
    expect(result.srsButtons).toBe(2)
    expect(result.ttsRate).toBe(1)
    expect(result.animations).toBe('on')
  })
})

describe('resolveTheme', () => {
  it('system следует prefers-color-scheme', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('явный выбор не зависит от системы', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})
