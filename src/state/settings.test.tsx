import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import i18n from '../i18n'
import { SettingsProvider, useSettings } from './settings'
import { db } from '../data/db'
import { saveSettings } from '../data/settings'
import { DEFAULT_SETTINGS } from '../domain/settings/types'

// Implements: plan://M10#10.1 — применение настроек провайдером

function Probe() {
  const { settings, update, ready } = useSettings()
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="theme">{settings.theme}</span>
      <button type="button" onClick={() => update({ theme: 'light' })}>
        light
      </button>
    </div>
  )
}

describe('SettingsProvider', () => {
  afterEach(async () => {
    await db.meta.clear()
    document.documentElement.dataset.theme = ''
    await i18n.changeLanguage('ru')
  })

  it('без сохранённых — дефолт: тёмная тема на html', async () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await act(async () => {})
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('update({theme:"light"}) применяет светлую тему и сохраняет её', async () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await act(async () => {})
    await act(async () => {
      document.querySelector('button')?.click()
    })
    expect(document.documentElement.dataset.theme).toBe('light')
    // roundtrip: значение реально в meta-таблице
    const stored = await db.meta.get('settings')
    expect(stored?.value).toMatchObject({ theme: 'light' })
  })

  it('сохранённая локаль применяется к i18n и <html lang>', async () => {
    await saveSettings(db.meta, { ...DEFAULT_SETTINGS, locale: 'en' })
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await act(async () => {})
    expect(i18n.language).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
