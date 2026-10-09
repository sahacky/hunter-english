// Implements: plan://audit-2026-10-08#W1 — тесты напоминания.
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { reminderDue, useReminder } from './useReminder'
import { SettingsProvider, useSettings } from './settings'
import '../i18n'

describe('reminderDue (чистая функция)', () => {
  const now = new Date('2026-10-08T20:30:00')
  it('выключено → никогда', () => {
    expect(reminderDue(now, null, null)).toBe(false)
  })
  it('до времени → нет; после → да', () => {
    expect(reminderDue(new Date('2026-10-08T18:59'), '19:00', null)).toBe(false)
    expect(reminderDue(new Date('2026-10-08T19:00'), '19:00', null)).toBe(true)
    expect(reminderDue(new Date('2026-10-08T21:15'), '19:00', null)).toBe(true)
  })
  it('уже показывали сегодня → нет; вчера показывали → да', () => {
    expect(reminderDue(now, '19:00', '2026-10-08')).toBe(false)
    expect(reminderDue(now, '19:00', '2026-10-07')).toBe(true)
  })
  it('битое время → нет (NaN-части и вне диапазона)', () => {
    expect(reminderDue(now, 'ab:cd', null)).toBe(false)
    expect(reminderDue(new Date('2026-10-08T18:00'), '25:99', null)).toBe(false)
  })
})

describe('useReminder (хук)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('в заданное время один раз в день показывает уведомление', () => {
    const ctor = vi.fn()
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    vi.setSystemTime(new Date('2026-10-08T19:00:00'))
    render(
      <SettingsProvider>
        <Probe time="19:00" />
      </SettingsProvider>,
    )
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('he-reminder-day')).toBe('2026-10-08')
    // следующая минута — тишина (уже показано)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(ctor).toHaveBeenCalledTimes(1)
  })

  it('выключено — уведомлений нет', () => {
    const ctor = vi.fn()
    vi.stubGlobal('Notification', Object.assign(ctor, { permission: 'granted' }))
    render(
      <SettingsProvider>
        <Probe time={null} />
      </SettingsProvider>,
    )
    act(() => {
      vi.advanceTimersByTime(120_000)
    })
    expect(ctor).not.toHaveBeenCalled()
  })
})

function Probe({ time }: { time: string | null }) {
  const { update } = useSettings()
  useEffect(() => {
    update({ reminderTime: time })
  }, [time, update])
  useReminder()
  return null
}
