import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import i18n from '../i18n'
import { SettingsProvider, useSettings } from './settings'
import { db } from '../data/db'
import { loadSettings, saveSettings } from '../data/settings'
import { DEFAULT_SETTINGS } from '../domain/settings/types'

// обёртки над реальными функциями: дефолтное поведение не меняется,
// тесты-хвосты подменяют результат через vi.mocked (веха S4)
vi.mock('../data/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settings')>()
  return {
    ...actual,
    loadSettings: vi.fn(actual.loadSettings),
    saveSettings: vi.fn(actual.saveSettings),
  }
})

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

  // Веха S4 (M21#21.4): дефолтный контекст, отказ loadSettings, meta theme-color,
  // системная смена темы, отказ saveSettings
  it('без провайдера: дефолтные настройки, update — no-op', async () => {
    render(<Probe />)
    await act(async () => {})
    expect(screen.getByTestId('ready')).toHaveTextContent('false')
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    document.querySelector('button')?.click() // дефолтный update — без эффекта
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it('loadSettings падает → дефолты, ready=true (catch глотает)', async () => {
    vi.mocked(loadSettings).mockRejectedValueOnce(new Error('db locked'))
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await act(async () => {})
    expect(screen.getByTestId('ready')).toHaveTextContent('true')
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it('тема зеркалится в meta[name=theme-color] (статус-бар PWA)', async () => {
    const meta = Object.assign(document.createElement('meta'), { name: 'theme-color' })
    document.head.appendChild(meta)
    try {
      render(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      )
      await act(async () => {})
      expect(meta.getAttribute('content')).toBe('#070b14') // тёмная
      await act(async () => {
        document.querySelector('button')?.click() // light
      })
      expect(meta.getAttribute('content')).toBe('#f2f6fb') // светлая
    } finally {
      meta.remove()
    }
  })

  it('системная смена темы (mq change) перекрашивает корень', async () => {
    const listeners: ((event: MediaQueryListEvent) => void)[] = []
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
          listeners.push(cb)
        },
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })),
    )
    try {
      render(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      )
      await act(async () => {})
      expect(listeners.length).toBeGreaterThan(0)
      const event = new Event('change')
      Object.defineProperty(event, 'matches', { value: true })
      act(() => listeners[0]?.(event as MediaQueryListEvent))
      // тема не system → выбор пользователя сохраняется (тёмная)
      expect(document.documentElement.dataset.theme).toBe('dark')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('saveSettings падает при update → UI применяет значение (catch глотает)', async () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    )
    await act(async () => {})
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error('quota'))
    await act(async () => {
      document.querySelector('button')?.click()
    })
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
